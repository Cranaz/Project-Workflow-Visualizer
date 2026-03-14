import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { createHash } from 'crypto';
import { parseProject } from '@/lib/parsers/index';
import { OLLAMA_MODELS } from '@/lib/ai/ollamaClient';
import { queueAnalysisJobs } from '@/lib/ai/analysisQueue';
import { getAnalysisEntry, setProjectSnapshot } from '@/lib/ai/analysisCache';
import { buildGraph } from '@/lib/graph/buildGraph';
import { computeLayout } from '@/lib/graph/layoutEngine';
import { shouldIgnorePath, isBinaryFile, isMinifiedFile, hasSourceFiles as checkHasSource, normalizePath } from '@/lib/utils/fileUtils';
import type { AnalyzeResponse } from '@/lib/types/project';
import type { ParsedProject } from '@/lib/types/project';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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

    // Parse project
    const parsed = parseProject(files);
    setProjectSnapshot(analysisId, parsed);

    // Kick off AI enrichment + file overviews in the background
    queueAnalysisJobs(analysisId, parsed);

    // Build graph (structural only for fast response)
    const { nodes, edges } = buildGraph(parsed, null);

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
    const cached = getAnalysisEntry(analysisId);

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
          aiTimeMs: cached?.aiTimeMs ?? 0,
          fileCount: parsed.totalFiles,
          nodeCount: positionedNodes.length,
          edgeCount: edges.length,
          aiAvailable: Boolean(cached?.projectEnrichment),
          aiModel: cached?.aiModel ?? OLLAMA_MODELS[0],
          warnings: cached?.projectEnrichment?.warnings ?? [],
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
