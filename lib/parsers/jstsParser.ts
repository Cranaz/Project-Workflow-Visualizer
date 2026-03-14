import type { ParsedFile, ParsedImport, ParsedExport, ReactComponentInfo, CustomHookInfo, ApiRouteInfo, ClassInfo, TypeDefinitionInfo, DatabaseModelInfo, ExternalCallInfo } from '@/lib/types/parser';
import { getFileName, countLines } from '@/lib/utils/fileUtils';

interface BabelParserModule {
  parse(code: string, options: Record<string, unknown>): ASTNode;
}

interface ASTNode {
  type: string;
  body?: ASTNode[];
  program?: ASTNode;
  declaration?: ASTNode;
  declarations?: ASTNode[];
  specifiers?: ASTNode[];
  source?: { value: string };
  id?: { name: string };
  name?: string;
  key?: { name: string };
  local?: { name: string };
  imported?: { name: string };
  exported?: { name: string };
  init?: ASTNode;
  superClass?: { name: string };
  implements?: ASTNode[];
  params?: ASTNode[];
  body2?: ASTNode;
  expression?: ASTNode;
  callee?: ASTNode;
  arguments?: ASTNode[];
  object?: ASTNode;
  property?: { name: string; value?: string };
  value?: string | number | boolean;
  returnType?: ASTNode;
  typeAnnotation?: ASTNode;
  members?: ASTNode[];
  typeParameters?: ASTNode;
  [key: string]: unknown;
}

const BABEL_PLUGINS = [
  'typescript',
  'jsx',
  'decorators-legacy',
  'classProperties',
  'dynamicImport',
  'optionalChaining',
  'nullishCoalescingOperator',
  'classPrivateProperties',
  'classPrivateMethods',
  'exportDefaultFrom',
  'exportNamespaceFrom',
  'asyncGenerators',
  'objectRestSpread',
  'topLevelAwait',
];

function isTsx(filePath: string): boolean {
  return filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
}

function parseAST(code: string, filePath: string, babelParser: BabelParserModule): ASTNode | null {
  try {
    return babelParser.parse(code, {
      sourceType: 'module',
      plugins: BABEL_PLUGINS,
      errorRecovery: true,
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      allowUndeclaredExports: true,
      ...(isTsx(filePath) ? {} : {}),
    });
  } catch {
    return null;
  }
}

function extractImports(ast: ASTNode): ParsedImport[] {
  const imports: ParsedImport[] = [];
  const body = ast.program?.body ?? ast.body ?? [];

  for (const node of body) {
    if (node.type === 'ImportDeclaration' && node.source?.value) {
      const specifiers: string[] = [];
      let isDefault = false;

      for (const spec of node.specifiers ?? []) {
        if (spec.type === 'ImportDefaultSpecifier') {
          specifiers.push(spec.local?.name ?? 'default');
          isDefault = true;
        } else if (spec.type === 'ImportSpecifier') {
          specifiers.push(spec.imported?.name ?? spec.local?.name ?? '');
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          specifiers.push(`* as ${spec.local?.name ?? ''}`);
        }
      }

      imports.push({
        source: node.source.value,
        specifiers,
        isDefault,
        isDynamic: false,
      });
    }
  }

  // Detect dynamic imports via regex fallback
  const dynamicImportRegex = /import\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const code = JSON.stringify(ast);
  let match: RegExpExecArray | null;
  const seen = new Set(imports.map(i => i.source));
  while ((match = dynamicImportRegex.exec(code)) !== null) {
    if (!seen.has(match[1])) {
      imports.push({
        source: match[1],
        specifiers: [],
        isDefault: false,
        isDynamic: true,
      });
      seen.add(match[1]);
    }
  }

  return imports;
}

function extractExports(ast: ASTNode): ParsedExport[] {
  const exports: ParsedExport[] = [];
  const body = ast.program?.body ?? ast.body ?? [];

  for (const node of body) {
    if (node.type === 'ExportDefaultDeclaration') {
      const decl = node.declaration;
      let name = 'default';
      let type: ParsedExport['type'] = 'unknown';

      if (decl) {
        if (decl.type === 'FunctionDeclaration' || decl.type === 'ArrowFunctionExpression') {
          name = decl.id?.name ?? 'default';
          type = 'function';
        } else if (decl.type === 'ClassDeclaration') {
          name = decl.id?.name ?? 'default';
          type = 'class';
        } else if (decl.type === 'Identifier') {
          name = decl.name ?? 'default';
        }
      }

      exports.push({ name, isDefault: true, type });
    } else if (node.type === 'ExportNamedDeclaration') {
      const decl = node.declaration;
      if (decl) {
        if (decl.type === 'FunctionDeclaration' && decl.id?.name) {
          exports.push({ name: decl.id.name, isDefault: false, type: 'function' });
        } else if (decl.type === 'ClassDeclaration' && decl.id?.name) {
          exports.push({ name: decl.id.name, isDefault: false, type: 'class' });
        } else if (decl.type === 'VariableDeclaration') {
          for (const d of decl.declarations ?? []) {
            if (d.id?.name) {
              exports.push({ name: d.id.name, isDefault: false, type: 'const' });
            }
          }
        } else if (decl.type === 'TSInterfaceDeclaration' && decl.id?.name) {
          exports.push({ name: decl.id.name, isDefault: false, type: 'interface' });
        } else if (decl.type === 'TSTypeAliasDeclaration' && decl.id?.name) {
          exports.push({ name: decl.id.name, isDefault: false, type: 'type' });
        }
      }

      for (const spec of node.specifiers ?? []) {
        if (spec.exported?.name) {
          exports.push({ name: spec.exported.name, isDefault: false, type: 'unknown' });
        }
      }
    }
  }

  return exports;
}

function detectComponents(ast: ASTNode, rawContent: string): ReactComponentInfo[] {
  const components: ReactComponentInfo[] = [];
  const body = ast.program?.body ?? ast.body ?? [];
  const hasJsx = rawContent.includes('JSX') || rawContent.includes('<') && (rawContent.includes('/>') || rawContent.includes('</'));

  for (const node of body) {
    const checkFunc = (name: string | undefined, isDefault: boolean) => {
      if (!name) return;
      if (name[0] === name[0].toUpperCase() && /^[A-Z]/.test(name)) {
        components.push({ name, isDefault, hasJsx });
      }
    };

    if (node.type === 'ExportDefaultDeclaration') {
      const decl = node.declaration;
      if (decl?.type === 'FunctionDeclaration') {
        checkFunc(decl.id?.name, true);
      }
    } else if (node.type === 'ExportNamedDeclaration') {
      const decl = node.declaration;
      if (decl?.type === 'FunctionDeclaration') {
        checkFunc(decl.id?.name, false);
      } else if (decl?.type === 'VariableDeclaration') {
        for (const d of decl.declarations ?? []) {
          checkFunc(d.id?.name, false);
        }
      }
    } else if (node.type === 'FunctionDeclaration') {
      checkFunc(node.id?.name, false);
    } else if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations ?? []) {
        checkFunc(d.id?.name, false);
      }
    }
  }

  // Also detect React.FC typed components via regex
  const fcRegex = /(?:const|let)\s+([A-Z]\w+)\s*:\s*(?:React\.)?FC/g;
  let fcMatch: RegExpExecArray | null;
  const seen = new Set(components.map(c => c.name));
  while ((fcMatch = fcRegex.exec(rawContent)) !== null) {
    if (!seen.has(fcMatch[1])) {
      components.push({ name: fcMatch[1], isDefault: false, hasJsx });
      seen.add(fcMatch[1]);
    }
  }

  return components;
}

function detectHooks(rawContent: string): CustomHookInfo[] {
  const hooks: CustomHookInfo[] = [];
  const hookRegex = /(?:export\s+)?(?:function|const)\s+(use[A-Z]\w+)/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((match = hookRegex.exec(rawContent)) !== null) {
    if (!seen.has(match[1])) {
      hooks.push({ name: match[1] });
      seen.add(match[1]);
    }
  }

  return hooks;
}

function detectApiRoutes(rawContent: string): ApiRouteInfo[] {
  const routes: ApiRouteInfo[] = [];

  // Next.js route handlers
  const nextRouteRegex = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = nextRouteRegex.exec(rawContent)) !== null) {
    routes.push({ method: match[1], handler: match[1] });
  }

  // Express-style routes
  const expressRegex = /(?:app|router)\.(get|post|put|delete|patch|use)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
  while ((match = expressRegex.exec(rawContent)) !== null) {
    routes.push({ method: match[1].toUpperCase(), path: match[2], handler: match[1] });
  }

  return routes;
}

function detectClasses(ast: ASTNode): ClassInfo[] {
  const classes: ClassInfo[] = [];
  const body = ast.program?.body ?? ast.body ?? [];

  const processClass = (node: ASTNode) => {
    if (node.type === 'ClassDeclaration' && node.id?.name) {
      const methods: string[] = [];
      const classBody = (node as Record<string, unknown>).body as ASTNode | undefined;
      const bodyItems = classBody?.body ?? [];
      for (const member of bodyItems) {
        if (member.type === 'ClassMethod' || member.type === 'MethodDefinition') {
          if (member.key?.name) methods.push(member.key.name);
        }
      }
      classes.push({
        name: node.id.name,
        methods,
        extends: node.superClass?.name,
        implements: (node.implements ?? []).map((i: ASTNode) => i.expression?.name ?? i.id?.name ?? '').filter(Boolean),
      });
    }
  };

  for (const node of body) {
    processClass(node);
    if (node.type === 'ExportDefaultDeclaration' || node.type === 'ExportNamedDeclaration') {
      if (node.declaration) processClass(node.declaration);
    }
  }

  return classes;
}

function detectTypeDefinitions(rawContent: string): TypeDefinitionInfo[] {
  const types: TypeDefinitionInfo[] = [];
  const interfaceRegex = /(?:export\s+)?interface\s+(\w+)\s*(?:extends\s+\w+\s*)?\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = interfaceRegex.exec(rawContent)) !== null) {
    const fields = match[2]
      .split(/[;\n]/)
      .map(f => f.trim())
      .filter(f => f && !f.startsWith('//'));
    types.push({ name: match[1], kind: 'interface', fields });
  }

  const typeRegex = /(?:export\s+)?type\s+(\w+)\s*=\s*/g;
  while ((match = typeRegex.exec(rawContent)) !== null) {
    types.push({ name: match[1], kind: 'type', fields: [] });
  }

  return types;
}

function detectEnvVariables(rawContent: string): string[] {
  const vars = new Set<string>();
  const regex = /process\.env\.(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(rawContent)) !== null) {
    vars.add(match[1]);
  }
  // Also check import.meta.env
  const metaRegex = /import\.meta\.env\.(\w+)/g;
  while ((match = metaRegex.exec(rawContent)) !== null) {
    vars.add(match[1]);
  }
  return [...vars];
}

function detectDatabaseModels(rawContent: string): DatabaseModelInfo[] {
  const models: DatabaseModelInfo[] = [];

  // Prisma models
  const prismaRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = prismaRegex.exec(rawContent)) !== null) {
    const fields = match[2].split('\n').map(f => f.trim()).filter(f => f && !f.startsWith('//') && !f.startsWith('@@'));
    models.push({ name: match[1], orm: 'Prisma', fields });
  }

  // Mongoose schemas
  const mongooseRegex = /new\s+(?:mongoose\.)?Schema\s*\(\s*\{/g;
  if (mongooseRegex.test(rawContent)) {
    const nameRegex = /(?:const|let|var)\s+(\w+)Schema/g;
    while ((match = nameRegex.exec(rawContent)) !== null) {
      models.push({ name: match[1], orm: 'Mongoose', fields: [] });
    }
  }

  // TypeORM entities
  const typeormRegex = /@Entity\(\)[\s\S]*?class\s+(\w+)/g;
  while ((match = typeormRegex.exec(rawContent)) !== null) {
    models.push({ name: match[1], orm: 'TypeORM', fields: [] });
  }

  // Drizzle tables
  const drizzleRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:pgTable|mysqlTable|sqliteTable)\s*\(/g;
  while ((match = drizzleRegex.exec(rawContent)) !== null) {
    models.push({ name: match[1], orm: 'Drizzle', fields: [] });
  }

  return models;
}

function detectExternalCalls(rawContent: string): ExternalCallInfo[] {
  const calls: ExternalCallInfo[] = [];
  const seen = new Set<string>();

  if (/\bfetch\s*\(/.test(rawContent)) {
    if (!seen.has('fetch')) {
      calls.push({ type: 'fetch' });
      seen.add('fetch');
    }
  }
  if (/\baxios\b/.test(rawContent)) {
    if (!seen.has('axios')) {
      calls.push({ type: 'axios' });
      seen.add('axios');
    }
  }
  if (/\btrpc\b|createTRPCClient/i.test(rawContent)) {
    if (!seen.has('trpc')) {
      calls.push({ type: 'trpc' });
      seen.add('trpc');
    }
  }
  if (/\bgql\b|graphql|useQuery|useMutation/i.test(rawContent)) {
    if (!seen.has('graphql')) {
      calls.push({ type: 'graphql' });
      seen.add('graphql');
    }
  }

  return calls;
}

export function parseJsTs(filePath: string, content: string, babelParser: BabelParserModule): ParsedFile {
  const ext = filePath.split('.').pop() ?? '';
  const language = ['ts', 'tsx'].includes(ext) ? 'TypeScript' : 'JavaScript';

  const baseFile: ParsedFile = {
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

  const ast = parseAST(content, filePath, babelParser);
  if (!ast) {
    baseFile.hasParseError = true;
    baseFile.parseErrorMessage = 'Failed to parse AST';
    // Fall back to regex-based extraction
    baseFile.hooks = detectHooks(content);
    baseFile.apiRoutes = detectApiRoutes(content);
    baseFile.envVariables = detectEnvVariables(content);
    baseFile.databaseModels = detectDatabaseModels(content);
    baseFile.externalCalls = detectExternalCalls(content);
    baseFile.typeDefinitions = detectTypeDefinitions(content);
    return baseFile;
  }

  baseFile.imports = extractImports(ast);
  baseFile.exports = extractExports(ast);
  baseFile.components = detectComponents(ast, content);
  baseFile.hooks = detectHooks(content);
  baseFile.apiRoutes = detectApiRoutes(content);
  baseFile.classes = detectClasses(ast);
  baseFile.typeDefinitions = detectTypeDefinitions(content);
  baseFile.envVariables = detectEnvVariables(content);
  baseFile.databaseModels = detectDatabaseModels(content);
  baseFile.externalCalls = detectExternalCalls(content);

  return baseFile;
}
