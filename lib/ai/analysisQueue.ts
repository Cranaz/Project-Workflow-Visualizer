import type { ParsedProject } from '@/lib/types/project';
import { enrichProject } from '@/lib/ai/enrichProject';
import { generateFileOverview } from '@/lib/ai/generateFileOverview';
import { ensureAnalysisEntry, setProjectEnrichment, setFileOverviewInCache } from '@/lib/ai/analysisCache';

const DEFAULT_FILE_OVERVIEW_CONCURRENCY = 4;
const DEFAULT_RESERVE_MB = 384;

const globalAny = globalThis as {
  __pvvAnalysisTasks?: Map<string, Promise<void>>;
};

const taskCache = globalAny.__pvvAnalysisTasks ?? new Map<string, Promise<void>>();
globalAny.__pvvAnalysisTasks = taskCache;

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
    const overview = await generateFileOverview({
      file,
      projectName: project.projectName,
      framework: project.detectedFramework,
    });
    setFileOverviewInCache(analysisId, file.filePath, overview);
  });
}

async function runAnalysisJobs(analysisId: string, project: ParsedProject): Promise<void> {
  ensureAnalysisEntry(analysisId);
  const reserveTarget = readInt(process.env.PVW_ANALYZE_MEMORY_MB, DEFAULT_RESERVE_MB);
  const releaseReserve = reserveMemory(reserveTarget, estimateProjectMb(project));

  try {
    const projectPromise = enrichProject(project).then((result) => {
      setProjectEnrichment(analysisId, result.enrichment, {
        aiModel: result.model,
      });
    });

    const filePromise = generateAllFileOverviews(analysisId, project);

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
