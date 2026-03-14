'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ReactFlowProvider } from 'reactflow';
import { TopBar } from '@/components/panels/TopBar';
import { SidebarLeft } from '@/components/panels/SidebarLeft';
import { StatsBar } from '@/components/panels/StatsBar';
import { WorkflowCanvas } from '@/components/canvas/WorkflowCanvas';
import { useWorkflowStore } from '@/lib/store/workflowStore';
import type { AiStatus } from '@/lib/types/project';
import { motion } from 'framer-motion';

interface HealthResponse {
  ollama: {
    running: boolean;
    modelAvailable: boolean;
    model: string;
    models?: string[];
    availableModels?: string[];
    status?: AiStatus;
    detail?: string;
  };
}

export default function AnalyzePage() {
  const router = useRouter();
  const parsedProject = useWorkflowStore((s) => s.parsedProject);
  const aiEnrichment = useWorkflowStore((s) => s.aiEnrichment);
  const aiStatus = useWorkflowStore((s) => s.aiStatus);
  const analysisId = useWorkflowStore((s) => s.projectMeta?.analysisId);
  const setAiStatus = useWorkflowStore((s) => s.setAiStatus);
  const setAiModel = useWorkflowStore((s) => s.setAiModel);
  const setAiDetail = useWorkflowStore((s) => s.setAiDetail);
  const setAiEnrichment = useWorkflowStore((s) => s.setAiEnrichment);
  const enrichInFlight = useRef(false);

  // Redirect to home if no project data
  useEffect(() => {
    if (!parsedProject) {
      router.push('/');
    }
  }, [parsedProject, router]);

  // Check AI status
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        const data = (await res.json()) as HealthResponse;
        if (isCancelled) return;
        setAiModel(data.ollama.model ?? null);
        setAiDetail(data.ollama.detail ?? null);

        const nextStatus: AiStatus =
          data.ollama.status ??
          (data.ollama.running && data.ollama.modelAvailable
            ? 'ready'
            : data.ollama.running
              ? 'limited'
              : 'offline');

        setAiStatus(nextStatus);
        if (nextStatus !== 'ready') {
          timeoutId = setTimeout(checkHealth, 5000);
        }
      } catch {
        if (isCancelled) return;
        setAiModel(null);
        setAiDetail(null);
        setAiStatus('offline');
        timeoutId = setTimeout(checkHealth, 5000);
      }
    }

    checkHealth();
    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [setAiStatus, setAiModel, setAiDetail]);

  // Auto-run AI enrichment when the engine becomes ready
  useEffect(() => {
    if (!parsedProject || aiEnrichment || aiStatus !== 'ready') return;

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const runEnrichment = async () => {
      if (cancelled || enrichInFlight.current) return;
      enrichInFlight.current = true;
      try {
        const response = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(analysisId ? { analysisId } : { project: parsedProject }),
        });

        const data = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          enrichment?: AnalyzeResponse['data']['aiEnrichment'];
          model?: string;
          aiTimeMs?: number;
          error?: string;
        };

        if (response.ok && data?.success && data.enrichment) {
          setAiEnrichment(data.enrichment, {
            aiModel: data.model,
            aiTimeMs: data.aiTimeMs,
          });
          setAiDetail(null);
          return;
        }

        setAiDetail(data?.error ?? 'AI enrichment failed. Retrying automatically...');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI enrichment failed. Retrying automatically...';
        setAiDetail(message);
      } finally {
        enrichInFlight.current = false;
        if (!cancelled) {
          retryTimer = setTimeout(runEnrichment, 8000);
        }
      }
    };

    runEnrichment();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [parsedProject, aiEnrichment, aiStatus, analysisId, setAiEnrichment, setAiDetail]);

  if (!parsedProject) {
    return (
      <div className="h-screen flex items-center justify-center bg-base">
        <p className="text-text-muted">Redirecting...</p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="h-screen flex flex-col bg-base overflow-hidden"
      >
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <SidebarLeft />
          <WorkflowCanvas />
        </div>
        <StatsBar />
      </motion.div>
    </ReactFlowProvider>
  );
}
