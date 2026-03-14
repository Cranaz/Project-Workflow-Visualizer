import type { ParsedFile } from '@/lib/types/parser';
import { getFileName, countLines } from '@/lib/utils/fileUtils';

export function parseMarkdown(filePath: string, content: string): ParsedFile {
  const ext = filePath.split('.').pop() ?? 'md';

  // Extract headings as "exports"
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const exports: ParsedFile['exports'] = [];
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    exports.push({
      name: match[2].trim(),
      isDefault: match[1].length === 1,
      type: 'const',
    });
  }

  // Extract links as "imports"
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  const imports: ParsedFile['imports'] = [];
  const seenLinks = new Set<string>();
  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[2];
    if (!seenLinks.has(url) && !url.startsWith('http') && !url.startsWith('#')) {
      imports.push({
        source: url,
        specifiers: [match[1] || url],
        isDefault: false,
        isDynamic: false,
      });
      seenLinks.add(url);
    }
  }

  return {
    filePath,
    fileName: getFileName(filePath),
    language: ext === 'mdx' ? 'MDX' : 'Markdown',
    extension: ext,
    lineCount: countLines(content),
    rawContent: content,
    imports,
    exports,
    components: [],
    hooks: [],
    apiRoutes: [],
    classes: [],
    typeDefinitions: [],
    envVariables: [],
    databaseModels: [],
    externalCalls: [],
    hasParseError: false,
  };
}
