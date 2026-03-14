const SOURCE_EXTENSIONS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'go', 'java', 'rs', 'rb',
  'php', 'cs', 'cpp', 'c', 'h', 'hpp', 'swift', 'kt', 'scala',
  'vue', 'svelte', 'astro',
]);

const STYLE_EXTENSIONS = new Set(['css', 'scss', 'sass', 'less', 'styl']);
const CONFIG_EXTENSIONS = new Set(['json', 'yaml', 'yml', 'toml', 'ini', 'xml']);
const MARKDOWN_EXTENSIONS = new Set(['md', 'mdx']);
const ENV_PATTERNS = ['.env', '.env.local', '.env.example', '.env.development', '.env.production'];
const TEST_PATTERNS = ['.test.', '.spec.', '__tests__', '__test__'];

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  'coverage', '.cache', '.vscode', '.idea', '.turbo', '.vercel',
  '.output', 'vendor', 'target', 'venv', '.venv', 'env',
]);

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'webp', 'bmp',
  'mp3', 'mp4', 'wav', 'avi', 'mov', 'woff', 'woff2', 'ttf',
  'eot', 'otf', 'zip', 'tar', 'gz', 'rar', 'pdf', 'exe',
  'dll', 'so', 'dylib', 'lock',
]);

export function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  if (parts.length < 2) return '';
  return parts[parts.length - 1].toLowerCase();
}

export function getFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || '';
}

export function getDirectoryPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash === -1) return '';
  return normalized.slice(0, lastSlash);
}

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function isSourceFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return SOURCE_EXTENSIONS.has(ext);
}

export function isStyleFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return STYLE_EXTENSIONS.has(ext);
}

export function isConfigFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  const fileName = getFileName(filePath);
  return CONFIG_EXTENSIONS.has(ext) || ENV_PATTERNS.some(p => fileName === p.slice(1) || fileName.startsWith(p.slice(1)));
}

export function isMarkdownFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return MARKDOWN_EXTENSIONS.has(ext);
}

export function isEnvFile(filePath: string): boolean {
  const fileName = getFileName(filePath);
  return ENV_PATTERNS.some(p => fileName === p.slice(1) || fileName.startsWith('.env'));
}

export function isTestFile(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return TEST_PATTERNS.some(p => normalized.includes(p));
}

export function isBinaryFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  return BINARY_EXTENSIONS.has(ext);
}

export function isMinifiedFile(filePath: string): boolean {
  const fileName = getFileName(filePath);
  return fileName.includes('.min.') || filePath.includes('/dist/') || filePath.includes('/build/');
}

export function shouldIgnorePath(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/');
  return parts.some(part => IGNORED_DIRS.has(part));
}

export function isValidProjectFile(filePath: string): boolean {
  if (shouldIgnorePath(filePath)) return false;
  if (isBinaryFile(filePath)) return false;
  if (isMinifiedFile(filePath)) return false;
  return true;
}

export function hasSourceFiles(filePaths: string[]): boolean {
  return filePaths.some(fp => isSourceFile(fp));
}

export function getLanguageFromExtension(ext: string): string {
  const map: Record<string, string> = {
    js: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
    py: 'Python', go: 'Go', java: 'Java', rs: 'Rust', rb: 'Ruby',
    php: 'PHP', cs: 'C#', cpp: 'C++', c: 'C', h: 'C', hpp: 'C++',
    swift: 'Swift', kt: 'Kotlin', scala: 'Scala', vue: 'Vue',
    svelte: 'Svelte', astro: 'Astro', css: 'CSS', scss: 'SCSS',
    sass: 'Sass', less: 'Less', json: 'JSON', yaml: 'YAML',
    yml: 'YAML', toml: 'TOML', md: 'Markdown', mdx: 'MDX',
    xml: 'XML', html: 'HTML', sql: 'SQL', sh: 'Shell',
    bash: 'Bash', zsh: 'Shell', fish: 'Shell', ps1: 'PowerShell',
  };
  return map[ext] ?? 'Unknown';
}

export function detectEntryPoint(filePath: string): boolean {
  const fileName = getFileName(filePath);
  const entryNames = [
    'index.ts', 'index.tsx', 'index.js', 'index.jsx',
    'main.ts', 'main.tsx', 'main.js', 'main.jsx',
    'app.ts', 'app.tsx', 'app.js', 'app.jsx',
    'server.ts', 'server.js', 'main.py', 'app.py',
    'manage.py', 'main.go', 'mod.rs', 'lib.rs',
  ];
  const normalized = normalizePath(filePath);
  const isPageRoute = normalized.includes('/app/') && (fileName === 'page.tsx' || fileName === 'page.ts');
  const isLayout = fileName === 'layout.tsx' || fileName === 'layout.ts';
  return entryNames.includes(fileName) || isPageRoute || isLayout;
}

export function countLines(content: string): number {
  if (!content) return 0;
  return content.split('\n').length;
}

export function truncateContent(content: string, maxLines: number): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;
  return lines.slice(0, maxLines).join('\n') + '\n// ... truncated';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildFileTree(filePaths: string[]): FileTreeNode {
  const root: FileTreeNode = { name: '', path: '', isDirectory: true, children: [] };
  for (const filePath of filePaths) {
    const parts = normalizePath(filePath).split('/').filter(Boolean);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      const partName = parts[i];
      let child = current.children.find(c => c.name === partName);
      if (!child) {
        child = {
          name: partName,
          path: parts.slice(0, i + 1).join('/'),
          isDirectory: !isLast,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }
  }
  sortFileTree(root);
  return root;
}

function sortFileTree(node: FileTreeNode): void {
  node.children.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    sortFileTree(child);
  }
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileTreeNode[];
}
