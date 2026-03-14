import { spawn } from 'child_process';

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const OLLAMA_HOST_CONFIGURED =
  typeof process.env.OLLAMA_HOST === 'string' && process.env.OLLAMA_HOST.trim().length > 0;
const IS_VERCEL = process.env.VERCEL === '1';
const DEFAULT_MODELS = [
  'qwen3.5:397b-cloud',
  'deepseek-v3.2:cloud',
  'glm-5:cloud',
  'kimi-k2.5:cloud',
];
const OLLAMA_BINARY = process.env.OLLAMA_BINARY ?? 'ollama';

function parseModelList(
  modelsList: string | undefined,
  primaryModel: string | undefined
): string[] {
  const entries = (modelsList ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const base = entries.length > 0
    ? entries
    : primaryModel
      ? [primaryModel, ...DEFAULT_MODELS]
      : [...DEFAULT_MODELS];

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const entry of base) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    unique.push(entry);
  }
  return unique.length > 0 ? unique : [...DEFAULT_MODELS];
}

export const OLLAMA_MODELS = parseModelList(
  process.env.OLLAMA_MODELS,
  process.env.OLLAMA_MODEL
);
export const OLLAMA_MODEL = OLLAMA_MODELS[0] ?? DEFAULT_MODELS[0];

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readFloat(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isLocalHost(host: string): boolean {
  try {
    const normalized = host.includes('://') ? host : `http://${host}`;
    const url = new URL(normalized);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '0.0.0.0';
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_NUM_CTX = readNumber(process.env.OLLAMA_NUM_CTX, 32768);
const DEFAULT_NUM_PREDICT = readNumber(process.env.OLLAMA_NUM_PREDICT, 12000);
const DEFAULT_TEMPERATURE = readFloat(process.env.OLLAMA_TEMPERATURE, 0.2);
const AUTO_START = (process.env.OLLAMA_AUTO_START ?? 'true') === 'true';
const AUTO_PULL = (process.env.OLLAMA_AUTO_PULL ?? 'true') === 'true';
const READY_TIMEOUT_MS = readNumber(process.env.OLLAMA_READY_TIMEOUT_MS, 60_000);
const READY_POLL_INTERVAL_MS = readNumber(process.env.OLLAMA_READY_POLL_INTERVAL_MS, 1_000);
const WAIT_TIMEOUT_MS = readNumber(process.env.OLLAMA_WAIT_TIMEOUT_MS, 600_000);
const WAIT_POLL_INTERVAL_MS = readNumber(process.env.OLLAMA_WAIT_POLL_INTERVAL_MS, 4_000);
const IS_LOCAL_HOST = isLocalHost(OLLAMA_HOST);
const VERCEL_HOST_WARNING =
  'Ollama cannot run inside Vercel. Set OLLAMA_HOST to a reachable Ollama server.';

let serveStarted = false;
let serveStarting: Promise<void> | null = null;
let pullInFlight: Promise<void> | null = null;
let lastStartError: string | null = null;
let lastPullError: string | null = null;
let serveDisabled = false;

interface OllamaCallOptions {
  numCtx?: number;
  numPredict?: number;
  temperature?: number;
}

type OllamaServiceStatus = 'ready' | 'starting' | 'pulling' | 'limited' | 'offline';

export interface OllamaReadyState {
  running: boolean;
  modelAvailable: boolean;
  status: OllamaServiceStatus;
  detail?: string;
}

async function runOllamaCommand(args: string[], detached = false): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(OLLAMA_BINARY, args, {
      stdio: 'ignore',
      windowsHide: true,
      detached,
    });

    child.on('error', (err) => reject(err));
    if (detached) {
      child.unref();
      resolve();
      return;
    }

    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ollama ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function startServe(): Promise<void> {
  if (serveStarted) return;
  if (serveDisabled) return;
  if (IS_VERCEL && !OLLAMA_HOST_CONFIGURED) {
    lastStartError = VERCEL_HOST_WARNING;
    serveDisabled = true;
    return;
  }
  if (!IS_LOCAL_HOST || !AUTO_START) return;
  if (serveStarting) return serveStarting;

  lastStartError = null;
  serveStarting = runOllamaCommand(['serve'], true)
    .then(() => {
      lastStartError = null;
    })
    .catch((err) => {
      lastStartError = err instanceof Error ? err.message : 'Failed to start Ollama';
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
      if (code === 'ENOENT') {
        serveDisabled = true;
      }
    })
    .finally(() => {
      serveStarted = lastStartError === null;
      serveStarting = null;
    });

  return serveStarting;
}

async function startPull(model: string): Promise<void> {
  if (!IS_LOCAL_HOST || !AUTO_PULL) return;
  if (pullInFlight) return pullInFlight;

  lastPullError = null;
  pullInFlight = runOllamaCommand(['pull', model])
    .then(() => {
      lastPullError = null;
    })
    .catch((err) => {
      lastPullError = err instanceof Error ? err.message : 'Failed to pull model';
    })
    .finally(() => {
      pullInFlight = null;
    });

  return pullInFlight;
}

async function pollStatus(
  model: string,
  predicate: (status: { running: boolean; modelAvailable: boolean }) => boolean,
  timeoutMs: number
): Promise<{ running: boolean; modelAvailable: boolean }> {
  const deadline = Date.now() + timeoutMs;
  let status = await checkOllamaStatus(model);
  if (predicate(status)) return status;

  while (Date.now() < deadline) {
    await delay(READY_POLL_INTERVAL_MS);
    status = await checkOllamaStatus(model);
    if (predicate(status)) break;
  }
  return status;
}

async function waitUntilReady(model: string): Promise<OllamaReadyState> {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  let state = await ensureOllamaReady({
    model,
    waitForModel: true,
    timeoutMs: Math.min(READY_TIMEOUT_MS, 15_000),
  });

  if (state.running && state.modelAvailable) {
    return state;
  }

  while (Date.now() < deadline) {
    await delay(WAIT_POLL_INTERVAL_MS);
    state = await ensureOllamaReady({
      model,
      waitForModel: true,
      timeoutMs: Math.min(READY_TIMEOUT_MS, 15_000),
    });
    if (state.running && state.modelAvailable) {
      return state;
    }
  }

  return state;
}

export async function ensureOllamaReady(
  options: { model?: string; waitForModel?: boolean; timeoutMs?: number } = {}
): Promise<OllamaReadyState> {
  if (IS_VERCEL && !OLLAMA_HOST_CONFIGURED) {
    return {
      running: false,
      modelAvailable: false,
      status: 'offline',
      detail: VERCEL_HOST_WARNING,
    };
  }

  const targetModel = options.model ?? OLLAMA_MODEL;
  const timeoutMs = options.timeoutMs ?? READY_TIMEOUT_MS;
  let status = await checkOllamaStatus(targetModel);
  let autoStartAttempted = false;
  let autoPullAttempted = false;

  if (!status.running && AUTO_START && IS_LOCAL_HOST) {
    autoStartAttempted = true;
    await startServe();
    status = await pollStatus(targetModel, (s) => s.running, timeoutMs);
  }

  if (status.running && !status.modelAvailable && AUTO_PULL && IS_LOCAL_HOST) {
    autoPullAttempted = true;
    void startPull(targetModel);
    if (options.waitForModel) {
      status = await pollStatus(targetModel, (s) => s.modelAvailable, timeoutMs);
    }
  }

  const hasStartError = Boolean(lastStartError) && !status.running;
  let serviceStatus: OllamaServiceStatus;
  if (status.running && status.modelAvailable) {
    serviceStatus = 'ready';
  } else if (!status.running && autoStartAttempted && !hasStartError) {
    serviceStatus = 'starting';
  } else if (status.running && !status.modelAvailable && (autoPullAttempted || pullInFlight)) {
    serviceStatus = 'pulling';
  } else if (status.running) {
    serviceStatus = 'limited';
  } else {
    serviceStatus = 'offline';
  }

  return {
    running: status.running,
    modelAvailable: status.modelAvailable,
    status: serviceStatus,
    detail: lastPullError ?? lastStartError ?? undefined,
  };
}

export async function callOllama(
  prompt: string,
  options: OllamaCallOptions = {}
): Promise<{ response: string; model: string }> {
  const availableNames = await getAvailableModels();
  const availableModels = resolveAvailableModels(availableNames);
  const orderedModels = [
    ...availableModels,
    ...OLLAMA_MODELS.filter((model) => !availableModels.includes(model)),
  ];

  let lastError: Error | null = null;

  for (const model of orderedModels) {
    const readiness = await waitUntilReady(model);

    if (!readiness.running) {
      lastError = new Error('AI engine is unavailable right now. The app will keep retrying.');
      break;
    }

    if (!readiness.modelAvailable) {
      lastError = new Error(`Model ${model} is not ready yet.`);
      continue;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000); // 10 minutes

    try {
      const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: options.temperature ?? DEFAULT_TEMPERATURE,
            num_ctx: options.numCtx ?? DEFAULT_NUM_CTX,
            num_predict: options.numPredict ?? DEFAULT_NUM_PREDICT,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Ollama error: ${response.status}${text ? ` - ${text}` : ''}`);
      }

      const data = (await response.json()) as { response: string };
      return { response: data.response, model };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Failed to generate response');
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error('No AI models are available right now.');
}

interface OllamaModel {
  name: string;
}

interface OllamaTagsResponse {
  models?: OllamaModel[];
}

async function fetchTags(): Promise<OllamaTagsResponse | null> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as OllamaTagsResponse;
  } catch {
    return null;
  }
}

export async function getAvailableModels(): Promise<string[]> {
  const data = await fetchTags();
  if (!data?.models) return [];
  return data.models.map((m) => m.name);
}

export function resolveAvailableModels(availableNames: string[]): string[] {
  if (availableNames.length === 0) return [];
  return OLLAMA_MODELS.filter((model) =>
    availableNames.some((name) => matchesModel(name, model))
  );
}

export async function checkOllamaStatus(
  model: string = OLLAMA_MODEL
): Promise<{
  running: boolean;
  modelAvailable: boolean;
}> {
  const data = await fetchTags();
  if (!data) {
    return { running: false, modelAvailable: false };
  }
  const modelAvailable =
    data.models?.some((m) => matchesModel(m.name, model)) ?? false;
  return { running: true, modelAvailable };
}

function matchesModel(name: string, expected: string): boolean {
  if (!expected) return false;
  if (name === expected) return true;
  if (!expected.includes(':')) {
    return name.startsWith(`${expected}:`) || name.includes(expected);
  }
  return false;
}
