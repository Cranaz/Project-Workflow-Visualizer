import type { ParsedFile } from '@/lib/types/parser';
import { callOllama } from '@/lib/ai/ollamaClient';
import { buildFileOverviewPrompt } from '@/lib/ai/buildFileOverviewPrompt';
import type { ParsedExport } from '@/lib/types/parser';

const MAX_OVERVIEW_CHARS = 120_000;

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

export async function generateFileOverview(input: {
  file: ParsedFile;
  projectName: string;
  framework: string;
}): Promise<{ overview: string; model: string; truncated: boolean }> {
  const { file, projectName, framework } = input;

  if (!file.rawContent) {
    return {
      overview:
        'This file contains no stored source content (e.g., secrets stripped or empty content).',
      model: 'none',
      truncated: false,
    };
  }

  const content = String(file.rawContent);
  const truncated = content.length > MAX_OVERVIEW_CHARS;
  const trimmed = truncated
    ? content.slice(0, MAX_OVERVIEW_CHARS) + '\n/* ... truncated */\n'
    : content;

  const lineCount =
    typeof file.lineCount === 'number' && file.lineCount > 0
      ? file.lineCount
      : trimmed.split('\n').length;

  const targetWords = Math.min(1200, Math.max(300, Math.round(lineCount * 3)));

  const normalizedImports = Array.isArray(file.imports)
    ? file.imports
        .filter((imp) => Boolean(imp?.source))
        .map((imp) => ({
          source: imp.source,
          specifiers: Array.isArray(imp.specifiers) ? imp.specifiers : [],
        }))
    : [];

  const normalizedExports: Array<Pick<ParsedExport, 'name' | 'type'>> = Array.isArray(file.exports)
    ? file.exports
        .filter((exp) => Boolean(exp?.name))
        .map((exp) => ({
          name: exp.name,
          type: normalizeExportType(exp.type),
        }))
    : [];

  const prompt = buildFileOverviewPrompt({
    projectName: projectName || 'Unknown Project',
    framework: framework || 'Unknown',
    filePath: file.filePath,
    language: file.language || 'Unknown',
    lineCount,
    imports: normalizedImports,
    exports: normalizedExports,
    content: trimmed,
    targetWords,
    truncated,
  });

  const numPredict = Math.min(4096, Math.max(800, targetWords * 2));
  const { response: overview, model } = await callOllama(prompt, { numPredict });

  return {
    overview: overview.trim(),
    model,
    truncated,
  };
}
