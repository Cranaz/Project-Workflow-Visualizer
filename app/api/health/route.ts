import { NextResponse } from 'next/server';
import {
  ensureOllamaReady,
  getAvailableModels,
  resolveAvailableModels,
  OLLAMA_MODELS,
} from '@/lib/ai/ollamaClient';

export async function GET(): Promise<NextResponse> {
  const ollamaStatus = await ensureOllamaReady({
    model: OLLAMA_MODELS[0],
    waitForModel: false,
    timeoutMs: 2500,
  });
  const availableNames = ollamaStatus.running ? await getAvailableModels() : [];
  const availableModels = resolveAvailableModels(availableNames);
  const modelAvailable = availableModels.length > 0;
  const activeModel = availableModels[0] ?? OLLAMA_MODELS[0];
  const status = modelAvailable ? 'ready' : ollamaStatus.status;

  return NextResponse.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ollama: {
      running: ollamaStatus.running,
      modelAvailable,
      model: activeModel,
      models: OLLAMA_MODELS,
      availableModels,
      status,
      detail: ollamaStatus.detail,
    },
  });
}
