import { NextRequest, NextResponse } from 'next/server';
import { callOllama } from '@/lib/ai/ollamaClient';
import { buildFileOverviewPrompt } from '@/lib/ai/buildFileOverviewPrompt';
import { getFileOverviewFromCache } from '@/lib/ai/analysisCache';
import type { ParsedExport } from '@/lib/types/parser';

const MAX_OVERVIEW_CHARS = 120_000;

interface FileOverviewRequest {
  filePath: string;
  content?: string;
  language?: string;
  lineCount?: number;
  imports?: Array<{ source: string; specifiers?: string[] }>;
  exports?: Array<{ name: string; type?: string }>;
  projectName?: string;
  framework?: string;
  analysisId?: string;
}

const EXPORT_TYPES: ParsedExport['type'][] = [
  'function',
  'class',
  'const',
  'type',
  'interface',
  'variable',
  'unknown',
];

function normalizeExportType(value: string | undefined): ParsedExport['type'] {
  if (value && EXPORT_TYPES.includes(value as ParsedExport['type'])) {
    return value as ParsedExport['type'];
  }
  return 'unknown';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as FileOverviewRequest;

    if (body?.analysisId && body?.filePath) {
      const cached = getFileOverviewFromCache(body.analysisId, body.filePath);
      if (cached) {
        return NextResponse.json({
          success: true,
          overview: cached.overview,
          model: cached.model,
          truncated: cached.truncated,
          cached: true,
        });
      }
      return NextResponse.json(
        { success: false, pending: true, error: 'File overview still generating' },
        { status: 202 }
      );
    }

    if (!body?.filePath || !body?.content) {
      return NextResponse.json(
        { success: false, error: 'filePath and content are required' },
        { status: 400 }
      );
    }

    const content = String(body.content);
    const truncated = content.length > MAX_OVERVIEW_CHARS;
    const trimmed = truncated
      ? content.slice(0, MAX_OVERVIEW_CHARS) + '\n/* ... truncated */\n'
      : content;

    const lineCount =
      typeof body.lineCount === 'number' && body.lineCount > 0
        ? body.lineCount
        : trimmed.split('\n').length;

    const targetWords = Math.min(1200, Math.max(300, Math.round(lineCount * 3)));

    const normalizedImports = Array.isArray(body.imports)
      ? body.imports
          .filter((imp) => Boolean(imp?.source))
          .map((imp) => ({
            source: imp.source,
            specifiers: Array.isArray(imp.specifiers) ? imp.specifiers : [],
          }))
      : [];

    const normalizedExports: Array<Pick<ParsedExport, 'name' | 'type'>> = Array.isArray(body.exports)
      ? body.exports
          .filter((exp) => Boolean(exp?.name))
          .map((exp) => ({
            name: exp.name,
            type: normalizeExportType(exp.type),
          }))
      : [];

    const prompt = buildFileOverviewPrompt({
      projectName: body.projectName ?? 'Unknown Project',
      framework: body.framework ?? 'Unknown',
      filePath: body.filePath,
      language: body.language ?? 'Unknown',
      lineCount,
      imports: normalizedImports,
      exports: normalizedExports,
      content: trimmed,
      targetWords,
      truncated,
    });

    const numPredict = Math.min(4096, Math.max(800, targetWords * 2));
    const { response: overview, model } = await callOllama(prompt, { numPredict });

    return NextResponse.json({
      success: true,
      overview: overview.trim(),
      model,
      truncated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate overview';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export const maxDuration = 300;
export const dynamic = 'force-dynamic';
