import type { ParsedProject } from '@/lib/types/project';
import { enrichProject } from '@/lib/ai/enrichProject';
import { generateFileOverview } from '@/lib/ai/generateFileOverview';
import {
  ensureAnalysisEntry,
  setProjectEnrichment,
  setFileOverviewInCache,
  setProjectStatus,
} from '@/lib/ai/analysisCache';

const DEFAULT_FILE_OVERVIEW_CONCURRENCY = 4;
const DEFAULT_RESERVE_MB = 384;

const globalAny = globalThis as {
  __pvvAnalysisTasks?: Map<string, Promise<void>>;
};

const taskCache = globalAny.__pvvAnalysisTasks ?? new Map<string, Promise<void>>();
globalAny.__pvvAnalysisTasks = taskCache;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function estimateProjectMb(project: ParsedProject): number {
  const bytes = project.files.reduce((sum, file) => sum + Buffer.byteLength(file.rawContent ?? ''), 0);
  return Math.round(bytes / (1024 * 1024));
}

function reserveMemory(targetMb: number, estimatedMb: number): () => void {
  const reserveMb = Math.max(0, targetMb - estimatedMb);
  if (reserveMb <= 0) return () => {};

  const buffers: Buffer[] = [];
  const totalBytes = reserveMb * 1024 * 1024;
  const chunkSize = 8 * 1024 * 1024;
  let allocated = 0;
  try {
    while (allocated < totalBytes) {
      const next = Math.min(chunkSize, totalBytes - allocated);
      buffers.push(Buffer.alloc(next));
      allocated += next;
    }
  } catch {
    // If memory reservation fails, continue without it.
  }

  return () => {
    buffers.length = 0;
    if (typeof (globalThis as { gc?: () => void }).gc === 'function') {
      try {
        (globalThis as { gc?: () => void }).gc?.();
      } catch {
        // ignore
      }
    }
  };
}

async function retryIndefinitely<T>(
  label: string,
  task: () => Promise<T>,
  onError?: (message: string) => void
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (err) {
      attempt += 1;
      const message = err instanceof Error ? err.message : `${label} failed`;
      if (onError) onError(message);
      const backoff = Math.min(60000, 2000 * Math.pow(2, Math.min(attempt, 4)));
      console.warn(`${label} failed (attempt ${attempt}). Retrying in ${backoff}ms.`, err);
      await delay(backoff);
    }
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current]);
    }
  });
  await Promise.all(runners);
}

async function generateAllFileOverviews(analysisId: string, project: ParsedProject): Promise<void> {
  const concurrency = readInt(process.env.PVW_FILE_OVERVIEW_CONCURRENCY, DEFAULT_FILE_OVERVIEW_CONCURRENCY);
  await runWithConcurrency(project.files, concurrency, async (file) => {
    await retryIndefinitely(`File overview: ${file.filePath}`, async () => {
      const overview = await generateFileOverview({
        file,
        projectName: project.projectName,
        framework: project.detectedFramework,
      });
      setFileOverviewInCache(analysisId, file.filePath, overview);
    });
  });
}

async function runAnalysisJobs(analysisId: string, project: ParsedProject): Promise<void> {
  ensureAnalysisEntry(analysisId);
  setProjectStatus(analysisId, 'working');
  const reserveTarget = readInt(process.env.PVW_ANALYZE_MEMORY_MB, DEFAULT_RESERVE_MB);
  const releaseReserve = reserveMemory(reserveTarget, estimateProjectMb(project));

  try {
    const projectPromise = retryIndefinitely(
      'Project enrichment',
      async () => {
        setProjectStatus(analysisId, 'working');
        const result = await enrichProject(project);
        setProjectEnrichment(analysisId, result.enrichment, {
          aiModel: result.model,
        });
        return result;
      },
      (message) => setProjectStatus(analysisId, 'error', message)
    );

    const filePromise = retryIndefinitely('File overview batch', async () => {
      await generateAllFileOverviews(analysisId, project);
    });

    await Promise.all([projectPromise, filePromise]);
  } finally {
    releaseReserve();
  }
}

export function queueAnalysisJobs(analysisId: string, project: ParsedProject): void {
  if (taskCache.has(analysisId)) return;
  const task = runAnalysisJobs(analysisId, project).finally(() => {
    taskCache.delete(analysisId);
  });
  taskCache.set(analysisId, task);
}
