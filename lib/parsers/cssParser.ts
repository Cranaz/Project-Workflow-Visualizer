import type { ParsedFile } from '@/lib/types/parser';
import { getFileName, countLines } from '@/lib/utils/fileUtils';

export function parseCss(filePath: string, content: string): ParsedFile {
  const ext = filePath.split('.').pop() ?? 'css';
  const language = ext === 'scss' ? 'SCSS' : ext === 'sass' ? 'Sass' : ext === 'less' ? 'Less' : 'CSS';

  const imports: ParsedFile['imports'] = [];
  const exports: ParsedFile['exports'] = [];

  // @import statements
  const importRegex = /@import\s+(?:url\()?\s*['"`]([^'"`]+)['"`]\s*\)?/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      source: match[1],
      specifiers: [],
      isDefault: false,
      isDynamic: false,
    });
  }

  // @use (SCSS)
  const useRegex = /@use\s+['"`]([^'"`]+)['"`]/g;
  while ((match = useRegex.exec(content)) !== null) {
    imports.push({
      source: match[1],
      specifiers: [],
      isDefault: false,
      isDynamic: false,
    });
  }

  // Detect CSS custom properties as exports
  const varRegex = /--([a-zA-Z][\w-]*)\s*:/g;
  const vars = new Set<string>();
  while ((match = varRegex.exec(content)) !== null) {
    vars.add(match[1]);
  }

  for (const v of vars) {
    exports.push({ name: `--${v}`, isDefault: false, type: 'variable' });
  }

  // Detect class selectors
  const classRegex = /\.([a-zA-Z_][\w-]*)\s*\{/g;
  const classes = new Set<string>();
  while ((match = classRegex.exec(content)) !== null) {
    classes.add(match[1]);
  }

  return {
    filePath,
    fileName: getFileName(filePath),
    language,
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
