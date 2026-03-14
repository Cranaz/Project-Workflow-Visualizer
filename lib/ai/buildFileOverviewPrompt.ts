import type { ParsedImport, ParsedExport } from '@/lib/types/parser';

interface BuildFileOverviewPromptInput {
  projectName: string;
  framework: string;
  filePath: string;
  language: string;
  lineCount: number;
  imports: Array<Pick<ParsedImport, 'source' | 'specifiers'>>;
  exports: Array<Pick<ParsedExport, 'name' | 'type'>>;
  content: string;
  targetWords: number;
  truncated: boolean;
}

export function buildFileOverviewPrompt({
  projectName,
  framework,
  filePath,
  language,
  lineCount,
  imports,
  exports,
  content,
  targetWords,
  truncated,
}: BuildFileOverviewPromptInput): string {
  const importList = imports
    .slice(0, 30)
    .map((imp) => {
      const specs = imp.specifiers?.length ? ` (${imp.specifiers.join(', ')})` : '';
      return `- ${imp.source}${specs}`;
    })
    .join('\n');

  const exportList = exports
    .slice(0, 30)
    .map((exp) => `- ${exp.name} (${exp.type})`)
    .join('\n');

  return `You are a senior software architect. Provide a detailed, thorough, and extensive overview of the file below.
Return markdown only. Do not return JSON. Do not wrap in code fences.
Aim for about ${targetWords} words (shorter only if the file is tiny).

Cover these sections with clear headings:
1) Purpose & Role
2) Key Structures (functions, classes, components, hooks)
3) Data Flow & Side Effects
4) External Dependencies & Integrations
5) Notable Patterns, Edge Cases, and Error Handling

Project: ${projectName}
Framework: ${framework}
File: ${filePath}
Language: ${language}
Lines: ${lineCount}

Imports:
${importList || '- (none)'}

Exports:
${exportList || '- (none)'}

${truncated ? 'NOTE: The file content below is truncated. If that limits certainty, mention it briefly.' : ''}

FILE CONTENT:
${content}
`;
}
