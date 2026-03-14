import type { ParsedFile, DependencyMap, EnvVariable } from '@/lib/types/parser';
import type { ParsedProject, ApiRoute, DatabaseModel } from '@/lib/types/project';
import { parseJsTs } from './jstsParser';
import { parsePython } from './pythonParser';
import { parseCss } from './cssParser';
import { parseJsonFile, parsePackageJson } from './jsonParser';
import { parseEnvFile, extractEnvVariables } from './envParser';
import { parseMarkdown } from './markdownParser';
import {
  getFileExtension,
  getFileName,
  isValidProjectFile,
  isSourceFile,
  getLanguageFromExtension,
  normalizePath,
  detectEntryPoint,
  countLines,
} from '@/lib/utils/fileUtils';

const MAX_FILES = 200;

interface BabelParserModule {
  parse(code: string, options: Record<string, unknown>): unknown;
}

function getBabelParser(): BabelParserModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@babel/parser') as BabelParserModule;
  } catch {
    return null;
  }
}

function getFilePriority(filePath: string): number {
  const name = getFileName(filePath);
  const normalized = normalizePath(filePath);

  if (detectEntryPoint(filePath)) return 0;
  if (normalized.includes('/api/') || normalized.includes('/routes/')) return 1;
  if (name.includes('schema') || name.includes('model') || name.includes('prisma')) return 2;
  if (normalized.includes('/components/') || normalized.includes('/pages/')) return 3;
  if (normalized.includes('/services/') || normalized.includes('/utils/') || normalized.includes('/lib/')) return 4;
  if (normalized.includes('/hooks/')) return 5;
  if (name.endsWith('.json') || name.endsWith('.yaml') || name.endsWith('.yml')) return 6;
  if (name.endsWith('.css') || name.endsWith('.scss')) return 7;
  if (name.includes('.test.') || name.includes('.spec.')) return 8;
  return 9;
}

function isTextContent(content: string): boolean {
  // Detect binary content by checking for null bytes
  for (let i = 0; i < Math.min(content.length, 512); i++) {
    if (content.charCodeAt(i) === 0) return false;
  }
  return true;
}

export function parseProject(files: Map<string, string>): ParsedProject {
  const babelParser = getBabelParser();

  // Filter and prioritize files
  let validPaths = [...files.keys()].filter(isValidProjectFile);
  validPaths.sort((a, b) => getFilePriority(a) - getFilePriority(b));

  if (validPaths.length > MAX_FILES) {
    validPaths = validPaths.slice(0, MAX_FILES);
  }

  const parsedFiles: ParsedFile[] = [];
  const allEnvVars: EnvVariable[] = [];
  let packageJsonData: ReturnType<typeof parsePackageJson> | null = null;
  let totalLinesOfCode = 0;
  const languageCounts = new Map<string, number>();

  for (const filePath of validPaths) {
    const content = files.get(filePath);
    if (!content || !isTextContent(content)) continue;

    const ext = getFileExtension(filePath);
    const fileName = getFileName(filePath);
    let parsed: ParsedFile | null = null;

    try {
      if (['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'].includes(ext)) {
        if (babelParser) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parsed = parseJsTs(filePath, content, babelParser as any);
        } else {
          // Fallback : create a basic ParsedFile with regex extraction
          parsed = createFallbackFile(filePath, content, ext);
        }
      } else if (ext === 'py') {
        parsed = parsePython(filePath, content);
      } else if (['css', 'scss', 'sass', 'less'].includes(ext)) {
        parsed = parseCss(filePath, content);
      } else if (ext === 'json') {
        if (fileName === 'package.json') {
          try {
            packageJsonData = parsePackageJson(content);
          } catch { /* noop */ }
        }
        parsed = parseJsonFile(filePath, content);
      } else if (fileName.startsWith('.env')) {
        parsed = parseEnvFile(filePath, content);
        allEnvVars.push(...extractEnvVariables(content));
      } else if (['md', 'mdx'].includes(ext)) {
        parsed = parseMarkdown(filePath, content);
      } else {
        // Generic fallback for other languages
        parsed = createFallbackFile(filePath, content, ext);
      }
    } catch {
      parsed = createErrorFile(filePath, content, ext);
    }

    if (parsed) {
      parsedFiles.push(parsed);
      totalLinesOfCode += parsed.lineCount;

      const lang = parsed.language;
      languageCounts.set(lang, (languageCounts.get(lang) ?? 0) + 1);
    }
  }

  // Detect languages
  const detectedLanguages = [...languageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  // Find entry points
  const entryPoints = parsedFiles
    .filter((f) => detectEntryPoint(f.filePath))
    .map((f) => f.filePath);

  // Collect all API routes
  const apiRoutes: ApiRoute[] = parsedFiles.flatMap((f) =>
    f.apiRoutes.map((r) => ({
      method: r.method,
      path: r.path ?? f.filePath,
      filePath: f.filePath,
      handler: r.handler,
    }))
  );

  // Collect all database models
  const databaseModels: DatabaseModel[] = parsedFiles.flatMap((f) =>
    f.databaseModels.map((m) => ({
      name: m.name,
      orm: m.orm,
      fields: m.fields,
      filePath: f.filePath,
    }))
  );

  // Build dependency map
  const dependencies: DependencyMap = packageJsonData
    ? {
        dependencies: packageJsonData.dependencies,
        devDependencies: packageJsonData.devDependencies,
      }
    : { dependencies: [], devDependencies: [] };

  const projectName = packageJsonData?.name ?? inferProjectName(files);
  const detectedFramework = packageJsonData?.detectedFramework ?? inferFramework(parsedFiles);

  return {
    projectName,
    detectedFramework,
    detectedLanguages,
    totalFiles: parsedFiles.length,
    totalLinesOfCode,
    files: parsedFiles,
    dependencies,
    entryPoints,
    apiRoutes,
    databaseModels,
    envVariables: allEnvVars,
  };
}

function inferProjectName(files: Map<string, string>): string {
  // Try to infer from the top-level directory
  const paths = [...files.keys()];
  if (paths.length > 0) {
    const first = normalizePath(paths[0]);
    const parts = first.split('/').filter(Boolean);
    if (parts.length > 1) return parts[0];
  }
  return 'Untitled Project';
}

function inferFramework(files: ParsedFile[]): string {
  for (const f of files) {
    const imports = f.imports.map((i) => i.source);
    if (imports.some((s) => s.includes('next'))) return 'Next.js';
    if (imports.some((s) => s.includes('vue'))) return 'Vue';
    if (imports.some((s) => s.includes('@angular'))) return 'Angular';
    if (imports.some((s) => s.includes('svelte'))) return 'Svelte';
    if (imports.some((s) => s.includes('flask'))) return 'Flask';
    if (imports.some((s) => s.includes('django'))) return 'Django';
    if (imports.some((s) => s.includes('fastapi'))) return 'FastAPI';
    if (imports.some((s) => s.includes('express'))) return 'Express';
  }
  return 'Unknown';
}

function createFallbackFile(filePath: string, content: string, ext: string): ParsedFile {
  const language = getLanguageFromExtension(ext);
  return {
    filePath,
    fileName: getFileName(filePath),
    language,
    extension: ext,
    lineCount: countLines(content),
    rawContent: content,
    imports: [],
    exports: [],
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

function createErrorFile(filePath: string, content: string, ext: string): ParsedFile {
  return {
    ...createFallbackFile(filePath, content, ext),
    hasParseError: true,
    parseErrorMessage: 'Failed to parse file',
  };
}
