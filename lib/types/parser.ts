export interface ParsedImport {
  source: string;
  specifiers: string[];
  isDefault: boolean;
  isDynamic: boolean;
}

export interface ParsedExport {
  name: string;
  isDefault: boolean;
  type: 'function' | 'class' | 'const' | 'type' | 'interface' | 'variable' | 'unknown';
}

export interface ReactComponentInfo {
  name: string;
  isDefault: boolean;
  hasJsx: boolean;
  propsType?: string;
}

export interface CustomHookInfo {
  name: string;
  returnType?: string;
}

export interface ApiRouteInfo {
  method: string;
  path?: string;
  handler: string;
}

export interface ClassInfo {
  name: string;
  methods: string[];
  extends?: string;
  implements: string[];
}

export interface TypeDefinitionInfo {
  name: string;
  kind: 'interface' | 'type';
  fields: string[];
}

export interface DatabaseModelInfo {
  name: string;
  orm: string;
  fields: string[];
}

export interface ExternalCallInfo {
  type: 'fetch' | 'axios' | 'trpc' | 'graphql' | 'other';
  url?: string;
}

export interface ParsedFile {
  filePath: string;
  fileName: string;
  language: string;
  extension: string;
  lineCount: number;
  rawContent: string;
  imports: ParsedImport[];
  exports: ParsedExport[];
  components: ReactComponentInfo[];
  hooks: CustomHookInfo[];
  apiRoutes: ApiRouteInfo[];
  classes: ClassInfo[];
  typeDefinitions: TypeDefinitionInfo[];
  envVariables: string[];
  databaseModels: DatabaseModelInfo[];
  externalCalls: ExternalCallInfo[];
  hasParseError: boolean;
  parseErrorMessage?: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  category: 'framework' | 'ui' | 'database' | 'testing' | 'devtool' | 'other';
  isDev: boolean;
}

export interface DependencyMap {
  dependencies: DependencyInfo[];
  devDependencies: DependencyInfo[];
}

export interface ScriptInfo {
  name: string;
  command: string;
}

export interface PackageJsonData {
  name: string;
  version: string;
  description: string;
  scripts: ScriptInfo[];
  dependencies: DependencyInfo[];
  devDependencies: DependencyInfo[];
  detectedFramework: string;
}

export interface TsConfigData {
  pathAliases: Record<string, string[]>;
}

export interface EnvVariable {
  name: string;
  category: 'database' | 'auth' | 'api' | 'public' | 'secret' | 'port' | 'other';
}

export interface ParseResult {
  file: ParsedFile;
  diagnostics: string[];
}
