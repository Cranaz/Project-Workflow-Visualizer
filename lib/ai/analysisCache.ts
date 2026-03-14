import type { AIEnrichmentResult, ParsedProject } from '@/lib/types/project';
import { normalizePath } from '@/lib/utils/fileUtils';

export interface CachedFileOverview {
  overview: string;
  model: string;
  truncated: boolean;
}

export interface AnalysisCacheEntry {
  projectEnrichment?: AIEnrichmentResult;
  fileOverviews: Record<string, CachedFileOverview>;
  aiModel?: string;
  aiTimeMs?: number;
  createdAt: number;
  projectSnapshot?: ParsedProject;
  projectStatus?: 'working' | 'ready' | 'error';
  projectError?: string;
}

const globalAny = globalThis as { __pvvAnalysisCache?: Map<string, AnalysisCacheEntry> };

const cache = globalAny.__pvvAnalysisCache ?? new Map<string, AnalysisCacheEntry>();
globalAny.__pvvAnalysisCache = cache;

function trimCache(maxEntries = 3) {
  if (cache.size <= maxEntries) return;
  const entries = Array.from(cache.entries());
  entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
  for (let i = 0; i < entries.length - maxEntries; i += 1) {
    cache.delete(entries[i][0]);
  }
}

export function getAnalysisEntry(id: string): AnalysisCacheEntry | null {
  return cache.get(id) ?? null;
}

export function ensureAnalysisEntry(id: string): AnalysisCacheEntry {
  let entry = cache.get(id);
  if (!entry) {
    entry = {
      fileOverviews: {},
      createdAt: Date.now(),
    };
    cache.set(id, entry);
    trimCache();
  }
  return entry;
}

export function setProjectEnrichment(
  id: string,
  enrichment: AIEnrichmentResult,
  meta?: { aiModel?: string; aiTimeMs?: number }
): void {
  const entry = ensureAnalysisEntry(id);
  entry.projectEnrichment = enrichment;
  entry.aiModel = meta?.aiModel;
  entry.aiTimeMs = meta?.aiTimeMs;
  entry.projectStatus = 'ready';
  entry.projectError = undefined;
}

export function setProjectSnapshot(id: string, project: ParsedProject): void {
  const entry = ensureAnalysisEntry(id);
  entry.projectSnapshot = project;
}

export function setProjectStatus(
  id: string,
  status: AnalysisCacheEntry['projectStatus'],
  error?: string
): void {
  const entry = ensureAnalysisEntry(id);
  entry.projectStatus = status;
  entry.projectError = error;
}

export function getProjectSnapshot(id: string): ParsedProject | null {
  return cache.get(id)?.projectSnapshot ?? null;
}

export function setFileOverviewInCache(
  id: string,
  filePath: string,
  data: CachedFileOverview
): void {
  const entry = ensureAnalysisEntry(id);
  entry.fileOverviews[normalizePath(filePath)] = data;
}

export function getFileOverviewFromCache(
  id: string,
  filePath: string
): CachedFileOverview | null {
  const entry = cache.get(id);
  if (!entry) return null;
  return entry.fileOverviews[normalizePath(filePath)] ?? null;
}
