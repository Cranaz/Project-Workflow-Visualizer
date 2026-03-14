'use client';

import { useState, useCallback } from 'react';
import { useWorkflowStore } from '@/lib/store/workflowStore';
import type { AnalyzeResponse } from '@/lib/types/project';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_RETRIES = 2;

export function useProjectUpload() {
  const [error, setError] = useState<string | null>(null);
  const {
    setUploadState,
    setUploadError,
    setProject,
    updateProcessingStep,
    setProcessingSteps,
    setAiEnrichment,
  } = useWorkflowStore();

  const resetSteps = useCallback(() => {
    setProcessingSteps([
      { label: 'Extracting files...', status: 'pending' },
      { label: 'Parsing source code...', status: 'pending' },
      { label: 'Mapping relationships...', status: 'pending' },
      { label: 'Generating AI overview...', status: 'pending' },
      { label: 'Building intelligent graph...', status: 'pending' },
      { label: 'Rendering visualization...', status: 'pending' },
    ]);
  }, [setProcessingSteps]);

  const runAiEnrichment = useCallback(
    async (project: AnalyzeResponse['data']['project'], analysisId?: string) => {
      try {
        updateProcessingStep(3, 'active');
        const response = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(analysisId ? { analysisId } : { project }),
        });

        const data = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          enrichment?: AnalyzeResponse['data']['aiEnrichment'];
          model?: string;
          aiTimeMs?: number;
          error?: string;
          pending?: boolean;
        };

        if (data?.pending) {
          updateProcessingStep(3, 'active');
          setTimeout(() => {
            void runAiEnrichment(project, analysisId);
          }, 2000);
          return;
        }

        if (!response.ok || !data?.success || !data.enrichment) {
          updateProcessingStep(3, 'done');
          return;
        }

        setAiEnrichment(data.enrichment, {
          aiModel: data.model,
          aiTimeMs: data.aiTimeMs,
        });
        updateProcessingStep(3, 'done');
      } catch {
        updateProcessingStep(3, 'done');
      }
    },
    [setAiEnrichment, updateProcessingStep]
  );

  const startProgressSimulation = useCallback(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const schedule = (delay: number, fn: () => void) => {
      timers.push(setTimeout(fn, delay));
    };

    // Move past "Extracting files" quickly so the UI doesn't appear stuck.
    schedule(700, () => {
      updateProcessingStep(0, 'done');
      updateProcessingStep(1, 'active');
    });

    schedule(1600, () => {
      updateProcessingStep(1, 'done');
      updateProcessingStep(2, 'active');
    });

    schedule(2800, () => {
      updateProcessingStep(2, 'done');
      updateProcessingStep(3, 'active');
    });

    schedule(4300, () => {
      updateProcessingStep(3, 'done');
      updateProcessingStep(4, 'active');
    });

    schedule(6000, () => {
      updateProcessingStep(4, 'done');
      updateProcessingStep(5, 'active');
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [updateProcessingStep]);

  const uploadFile = useCallback(
    async (file: File): Promise<boolean> => {
      setError(null);
      resetSteps();
      setUploadState('uploading');

      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setError(`File too large: ${sizeMB}MB (max 50MB)`);
        setUploadError(`File too large: ${sizeMB}MB (max 50MB)`);
        return false;
      }

      const formData = new FormData();
      formData.append('file', file);

      let retries = 0;
      while (retries <= MAX_RETRIES) {
        let stopSimulation: (() => void) | null = null;
        try {
          updateProcessingStep(0, 'active');
          setUploadState('uploading');
          stopSimulation = startProgressSimulation();

          const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData,
          });

          updateProcessingStep(0, 'done');
          updateProcessingStep(1, 'active');
          setUploadState('parsing');

          if (!response.ok) {
            const errData = (await response.json().catch(() => ({}))) as { error?: string };
            throw new Error(errData.error ?? `Server error: ${response.status}`);
          }

          updateProcessingStep(1, 'done');
          updateProcessingStep(2, 'active');
          setUploadState('enriching');

          const result = (await response.json()) as AnalyzeResponse;

          if (!result.success) {
            throw new Error(result.error ?? 'Analysis failed');
          }

          updateProcessingStep(2, 'done');
          updateProcessingStep(4, 'active');

          setUploadState('building');
          updateProcessingStep(4, 'done');
          updateProcessingStep(5, 'active');

          setProject(result.data);
          updateProcessingStep(5, 'done');

          void runAiEnrichment(result.data.project, result.data.meta.analysisId);
          stopSimulation?.();

          return true;
        } catch (err) {
          stopSimulation?.();
          retries++;
          if (retries > MAX_RETRIES) {
            const msg = err instanceof Error ? err.message : 'Upload failed';
            setError(msg);
            setUploadError(msg);
            return false;
          }
          // Exponential backoff
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries - 1)));
        }
      }
      return false;
    },
    [setUploadState, setUploadError, setProject, updateProcessingStep, resetSteps, setError]
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]): Promise<boolean> => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return false;

      // If single file and it's a zip, upload directly
      if (fileArray.length === 1 && fileArray[0].name.endsWith('.zip')) {
        return uploadFile(fileArray[0]);
      }

      // For multiple files, create a FormData with all files
      setError(null);
      resetSteps();
      setUploadState('uploading');

      const totalSize = fileArray.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_FILE_SIZE) {
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
        setError(`Total size too large: ${sizeMB}MB (max 50MB)`);
        setUploadError(`Total size too large: ${sizeMB}MB (max 50MB)`);
        return false;
      }

      const formData = new FormData();
      for (const file of fileArray) {
        formData.append('files[]', file);
      }

      let stopSimulation: (() => void) | null = null;
      try {
        updateProcessingStep(0, 'active');
        stopSimulation = startProgressSimulation();

        const response = await fetch('/api/analyze', {
          method: 'POST',
          body: formData,
        });

        updateProcessingStep(0, 'done');
        updateProcessingStep(1, 'active');
        setUploadState('parsing');

        if (!response.ok) {
          const errData = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error ?? `Server error: ${response.status}`);
        }

        const result = (await response.json()) as AnalyzeResponse;
        if (!result.success) throw new Error(result.error ?? 'Analysis failed');

        updateProcessingStep(1, 'done');
        updateProcessingStep(2, 'done');
        updateProcessingStep(4, 'active');
        setUploadState('building');
        updateProcessingStep(4, 'done');
        updateProcessingStep(5, 'active');

        setProject(result.data);
        updateProcessingStep(5, 'done');
        void runAiEnrichment(result.data.project, result.data.meta.analysisId);
        stopSimulation?.();
        return true;
      } catch (err) {
        stopSimulation?.();
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setError(msg);
        setUploadError(msg);
        return false;
      }
    },
    [uploadFile, setUploadState, setUploadError, setProject, updateProcessingStep, resetSteps, setError]
  );

  return { uploadFile, uploadFiles, error };
}
