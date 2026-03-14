import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { createHash } from 'crypto';
import { parseProject } from '@/lib/parsers/index';
import { OLLAMA_MODELS } from '@/lib/ai/ollamaClient';
import { enrichProject } from '@/lib/ai/enrichProject';
import { generateFileOverview } from '@/lib/ai/generateFileOverview';
import { getAnalysisEntry, setProjectEnrichment, setFileOverviewInCache } from '@/lib/ai/analysisCache';
import { buildGraph } from '@/lib/graph/buildGraph';
import { computeLayout } from '@/lib/graph/layoutEngine';
import { shouldIgnorePath, isBinaryFile, isMinifiedFile, hasSourceFiles as checkHasSource, normalizePath } from '@/lib/utils/fileUtils';
import type { AnalyzeResponse } from '@/lib/types/project';
import type { ParsedProject } from '@/lib/types/project';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const FILE_OVERVIEW_CONCURRENCY = 3;

function createAnalysisId(files: Map<string, string>): string {
  const hash = createHash('sha1');
  const entries = Array.from(files.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [path, content] of entries) {
    hash.update(path);
    hash.update(String(content.length));
    hash.update(content);
  }
  return hash.digest('hex');
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current]);
    }
  });
  await Promise.all(runners);
}

async function generateAllFileOverviews(analysisId: string, project: ParsedProject) {
  const files = project.files;
  await runWithConcurrency(files, FILE_OVERVIEW_CONCURRENCY, async (file) => {
    const overview = await generateFileOverview({
      file,
      projectName: project.projectName,
      framework: project.detectedFramework,
    });
    setFileOverviewInCache(analysisId, file.filePath, overview);
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, error: 'Expected multipart/form-data' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const files = new Map<string, string>();

    // Handle single ZIP file
    const zipFile = formData.get('file') as File | null;
    const multiFiles = formData.getAll('files[]') as File[];

    if (zipFile && zipFile.name.endsWith('.zip')) {
      if (zipFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: `File too large: ${(zipFile.size / (1024 * 1024)).toFixed(1)}MB (max 50MB)` },
          { status: 413 }
        );
      }

      try {
        const buffer = await zipFile.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);

        const entries: Array<{ path: string; file: JSZip.JSZipObject }> = [];
        zip.forEach((relativePath, file) => {
          if (!file.dir) {
            entries.push({ path: relativePath, file });
          }
        });

        for (const entry of entries) {
          const normalized = normalizePath(entry.path);
          if (shouldIgnorePath(normalized)) continue;
          if (isBinaryFile(normalized)) continue;
          if (isMinifiedFile(normalized)) continue;

          try {
            const content = await entry.file.async('string');
            files.set(normalized, content);
          } catch {
            // Skip files that can't be read as text
          }
        }
      } catch {
        return NextResponse.json(
          { success: false, error: 'Failed to extract ZIP file' },
          { status: 422 }
        );
      }
    } else if (multiFiles.length > 0) {
      const totalSize = multiFiles.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: `Total size too large: ${(totalSize / (1024 * 1024)).toFixed(1)}MB (max 50MB)` },
          { status: 413 }
        );
      }

      for (const file of multiFiles) {
        const path = normalizePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
        if (shouldIgnorePath(path)) continue;
        if (isBinaryFile(path)) continue;
        if (isMinifiedFile(path)) continue;

        try {
          const content = await file.text();
          files.set(path, content);
        } catch {
          // Skip files that can't be read
        }
      }
    } else if (zipFile) {
      // Single non-zip file
      if (zipFile.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: 'File too large' },
          { status: 413 }
        );
      }
      const content = await zipFile.text();
      files.set(normalizePath(zipFile.name), content);
    } else {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    if (files.size === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid source files found in upload' },
        { status: 400 }
      );
    }

    if (!checkHasSource([...files.keys()])) {
      return NextResponse.json(
        { success: false, error: 'No recognized source files found. Upload must contain at least one .js, .ts, .py, .go, .java, .rs, .rb, .php, .cs, or .cpp file.' },
        { status: 400 }
      );
    }

    const analysisId = createAnalysisId(files);
    const cached = getAnalysisEntry(analysisId);

    // Parse project
    const parsed = parseProject(files);

    // Generate AI overview + file overviews during analysis
    let aiEnrichment = cached?.projectEnrichment ?? null;
    let aiModelUsed = cached?.aiModel ?? OLLAMA_MODELS[0];
    let aiTimeMs = cached?.aiTimeMs ?? 0;

    if (!aiEnrichment) {
      const aiStart = Date.now();
      const aiResult = await enrichProject(parsed);
      aiTimeMs = Date.now() - aiStart;
      aiEnrichment = aiResult.enrichment;
      aiModelUsed = aiResult.model;
      setProjectEnrichment(analysisId, aiEnrichment, {
        aiModel: aiModelUsed,
        aiTimeMs,
      });
    }

    const cachedFileCount = cached?.fileOverviews ? Object.keys(cached.fileOverviews).length : 0;
    if (cachedFileCount < parsed.files.length) {
      await generateAllFileOverviews(analysisId, parsed);
    }

    // Build graph (with AI enrichment data applied to nodes)
    const { nodes, edges } = buildGraph(parsed, aiEnrichment);

    // Layout
    const positions = computeLayout(nodes, edges, {
      direction: 'LR',
      rankSep: 120,
      nodeSep: 80,
    });

    const positionedNodes = nodes.map((node) => ({
      ...node,
      position: positions[node.id] ?? { x: 0, y: 0 },
    }));

    const processingTimeMs = Date.now() - startTime;

    const clientProject: ParsedProject = {
      ...parsed,
      files: parsed.files.map((file) => ({
        ...file,
        rawContent: '',
      })),
    };

    const response: AnalyzeResponse = {
      success: true,
      data: {
        project: clientProject,
        aiEnrichment: null,
        graph: {
          nodes: positionedNodes,
          edges,
        },
        meta: {
          processingTimeMs,
          aiTimeMs,
          fileCount: parsed.totalFiles,
          nodeCount: positionedNodes.length,
          edgeCount: edges.length,
          aiAvailable: Boolean(aiEnrichment),
          aiModel: aiModelUsed,
          warnings: aiEnrichment?.warnings ?? [],
          analysisId,
        },
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('Analysis error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export const maxDuration = 1200; // 20 minutes maximum
export const dynamic = 'force-dynamic';
