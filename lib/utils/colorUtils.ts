import type { NodeType } from '@/lib/types/graph';

const NODE_TYPE_COLORS: Record<NodeType, string> = {
  entry: '#F59E0B',
  component: '#6366F1',
  hook: '#8B5CF6',
  api: '#10B981',
  service: '#3B82F6',
  database: '#EF4444',
  config: '#6B7280',
  style: '#EC4899',
  test: '#F97316',
  external: '#14B8A6',
};

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3776AB',
  Go: '#00ADD8',
  Java: '#ED8B00',
  Rust: '#DEA584',
  Ruby: '#CC342D',
  PHP: '#777BB4',
  'C#': '#239120',
  'C++': '#00599C',
  C: '#A8B9CC',
  Swift: '#FA7343',
  Kotlin: '#7F52FF',
  Scala: '#DC322F',
  Vue: '#4FC08D',
  Svelte: '#FF3E00',
  Astro: '#FF5E00',
  CSS: '#1572B6',
  SCSS: '#CC6699',
  JSON: '#292929',
  YAML: '#CB171E',
  Markdown: '#083FA1',
  HTML: '#E34C26',
  SQL: '#4479A1',
  Shell: '#89E051',
  Unknown: '#6B7280',
};

export function getNodeTypeColor(nodeType: NodeType): string {
  return NODE_TYPE_COLORS[nodeType] ?? '#6B7280';
}

export function getLanguageColor(language: string): string {
  return LANGUAGE_COLORS[language] ?? '#6B7280';
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getHttpMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: '#10B981',
    POST: '#3B82F6',
    PUT: '#F59E0B',
    DELETE: '#EF4444',
    PATCH: '#8B5CF6',
  };
  return colors[method.toUpperCase()] ?? '#6B7280';
}

export function getEdgeTypeColor(edgeType: string): string {
  const colors: Record<string, string> = {
    import: '#4B5563',
    dataflow: '#6366F1',
    api_call: '#3B82F6',
    db_query: '#10B981',
    renders: '#EC4899',
    uses_hook: '#8B5CF6',
    inferred: '#A855F7',
  };
  return colors[edgeType] ?? '#4B5563';
}
