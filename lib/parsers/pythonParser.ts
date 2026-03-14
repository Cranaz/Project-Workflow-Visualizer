import type { ParsedFile, ParsedImport, ParsedExport, ApiRouteInfo, ClassInfo, DatabaseModelInfo } from '@/lib/types/parser';
import { getFileName, countLines } from '@/lib/utils/fileUtils';

function extractPythonImports(content: string): ParsedImport[] {
  const imports: ParsedImport[] = [];

  // "from X import Y, Z"
  const fromImportRegex = /^from\s+([\w.]+)\s+import\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = fromImportRegex.exec(content)) !== null) {
    const specifiers = match[2].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    imports.push({
      source: match[1],
      specifiers,
      isDefault: false,
      isDynamic: false,
    });
  }

  // "import X" or "import X as Y"
  const importRegex = /^import\s+([\w.]+)(?:\s+as\s+\w+)?$/gm;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push({
      source: match[1],
      specifiers: [match[1].split('.').pop() ?? match[1]],
      isDefault: true,
      isDynamic: false,
    });
  }

  return imports;
}

function extractPythonExports(content: string): ParsedExport[] {
  const exports: ParsedExport[] = [];

  // Functions
  const funcRegex = /^def\s+(\w+)\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = funcRegex.exec(content)) !== null) {
    if (!match[1].startsWith('_')) {
      exports.push({ name: match[1], isDefault: false, type: 'function' });
    }
  }

  // Classes
  const classRegex = /^class\s+(\w+)\s*[:(]/gm;
  while ((match = classRegex.exec(content)) !== null) {
    exports.push({ name: match[1], isDefault: false, type: 'class' });
  }

  // Top-level constants
  const constRegex = /^([A-Z_][A-Z0-9_]*)\s*=/gm;
  while ((match = constRegex.exec(content)) !== null) {
    exports.push({ name: match[1], isDefault: false, type: 'const' });
  }

  return exports;
}

function extractPythonClasses(content: string): ClassInfo[] {
  const classes: ClassInfo[] = [];
  const classRegex = /^class\s+(\w+)\s*(?:\(([^)]*)\))?\s*:/gm;
  let match: RegExpExecArray | null;

  while ((match = classRegex.exec(content)) !== null) {
    const className = match[1];
    const parents = match[2] ? match[2].split(',').map(p => p.trim()) : [];
    const extendsClass = parents[0] && parents[0] !== 'object' ? parents[0] : undefined;

    // Find methods in this class
    const methods: string[] = [];
    const classStart = match.index + match[0].length;
    const restOfFile = content.slice(classStart);
    const methodRegex = /^\s+def\s+(\w+)\s*\(/gm;
    let methodMatch: RegExpExecArray | null;

    while ((methodMatch = methodRegex.exec(restOfFile)) !== null) {
      methods.push(methodMatch[1]);
      // Stop if we hit a new top-level class or function
      const nextLine = restOfFile.slice(methodMatch.index + methodMatch[0].length);
      if (/^\S/m.test(nextLine.split('\n')[1] ?? '')) break;
    }

    classes.push({
      name: className,
      methods,
      extends: extendsClass,
      implements: [],
    });
  }

  return classes;
}

function extractPythonRoutes(content: string): ApiRouteInfo[] {
  const routes: ApiRouteInfo[] = [];

  // Flask/FastAPI decorators
  const routeRegex = /@(?:app|router|blueprint)\.(get|post|put|delete|patch|route)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  let match: RegExpExecArray | null;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toLowerCase() === 'route' ? 'GET' : match[1].toUpperCase();
    routes.push({ method, path: match[2], handler: match[1] });
  }

  // Django URL patterns
  const djangoRegex = /path\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)/g;
  while ((match = djangoRegex.exec(content)) !== null) {
    routes.push({ method: 'GET', path: match[1], handler: match[2] });
  }

  return routes;
}

function extractPythonModels(content: string): DatabaseModelInfo[] {
  const models: DatabaseModelInfo[] = [];

  // SQLAlchemy models
  const saRegex = /class\s+(\w+)\s*\(\s*(?:db\.Model|Base|DeclarativeBase)/g;
  let match: RegExpExecArray | null;
  while ((match = saRegex.exec(content)) !== null) {
    models.push({ name: match[1], orm: 'SQLAlchemy', fields: [] });
  }

  // Django models
  const djangoRegex = /class\s+(\w+)\s*\(\s*models\.Model\s*\)/g;
  while ((match = djangoRegex.exec(content)) !== null) {
    models.push({ name: match[1], orm: 'Django', fields: [] });
  }

  return models;
}

function extractPythonEnvVars(content: string): string[] {
  const vars = new Set<string>();
  const regex = /os\.(?:environ|getenv)\s*[[(]\s*['"`](\w+)['"`]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    vars.add(match[1]);
  }
  return [...vars];
}

export function parsePython(filePath: string, content: string): ParsedFile {
  return {
    filePath,
    fileName: getFileName(filePath),
    language: 'Python',
    extension: 'py',
    lineCount: countLines(content),
    rawContent: content,
    imports: extractPythonImports(content),
    exports: extractPythonExports(content),
    components: [],
    hooks: [],
    apiRoutes: extractPythonRoutes(content),
    classes: extractPythonClasses(content),
    typeDefinitions: [],
    envVariables: extractPythonEnvVars(content),
    databaseModels: extractPythonModels(content),
    externalCalls: [],
    hasParseError: false,
  };
}
