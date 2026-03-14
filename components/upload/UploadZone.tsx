'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileArchive, FolderOpen, AlertCircle, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useProjectUpload } from '@/hooks/useProjectUpload';
import { useWorkflowStore } from '@/lib/store/workflowStore';
import { getLanguageColor } from '@/lib/utils/colorUtils';
import { isSourceFile, getFileExtension, getLanguageFromExtension, formatFileSize } from '@/lib/utils/fileUtils';

const ACCEPTED_SOURCE_EXTS = ['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'java', 'rs', 'rb', 'php', 'cs', 'cpp'];

export function UploadZone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragType, setDragType] = useState<'zip' | 'folder' | 'files' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploadFiles, error } = useProjectUpload();
  const uploadState = useWorkflowStore((s) => s.uploadState);
  const processingSteps = useWorkflowStore((s) => s.processingSteps);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsed, setElapsed] = useState<number>(0);

  const isProcessing = uploadState !== 'idle' && uploadState !== 'success' && uploadState !== 'error';

  const languageBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of selectedFiles) {
      const ext = getFileExtension(file.name);
      if (ext) {
        const lang = getLanguageFromExtension(ext);
        counts.set(lang, (counts.get(lang) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([lang, count]) => ({ lang, count, color: getLanguageColor(lang) }));
  }, [selectedFiles]);

  const hasSourceFiles = useMemo(() => {
    if (selectedFiles.length === 1 && selectedFiles[0].name.endsWith('.zip')) {
      return true;
    }
    return selectedFiles.some((f) => isSourceFile(f.name));
  }, [selectedFiles]);

  const totalSize = useMemo(() => {
    return selectedFiles.reduce((sum, f) => sum + f.size, 0);
  }, [selectedFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
    const items = e.dataTransfer.items;
    if (items.length === 1 && items[0].type === 'application/zip') {
      setDragType('zip');
    } else {
      setDragType('files');
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragType(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragType(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    setStartTime(Date.now());
    const timer = setInterval(() => {
      setElapsed(Date.now() - Date.now() + (Date.now() - (startTime || Date.now())));
    }, 100);

    const elapsedTimer = setInterval(() => {
      setElapsed((prev) => prev + 100);
    }, 100);

    setElapsed(0);

    try {
      if (selectedFiles.length === 1 && selectedFiles[0].name.endsWith('.zip')) {
        await uploadFile(selectedFiles[0]);
      } else {
        await uploadFiles(selectedFiles);
      }
    } finally {
      clearInterval(timer);
      clearInterval(elapsedTimer);
    }
  }, [selectedFiles, uploadFile, uploadFiles, startTime]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-base px-4">
      {/* Logo & Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold text-gradient mb-2">
          Project Workflow Visualizer
        </h1>
        <p className="text-text-secondary text-base">
          Upload your project to generate an AI-powered interactive workflow map
        </p>
      </motion.div>

      {/* Upload Zone */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-2xl"
      >
        {!isProcessing ? (
          <>
            <div
              className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 cursor-pointer ${
                isDragOver
                  ? 'border-accent-primary bg-accent-primary/5 pulse-glow'
                  : 'border-border-muted hover:border-border-default hover:bg-surface/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload zone. Click or drag files to upload."
              onKeyDown={(e) => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleFileInput}
                aria-label="Select ZIP file"
              />
              <input
                ref={folderInputRef}
                type="file"
                className="hidden"
                onChange={handleFileInput}
                {...{ webkitdirectory: 'true', directory: 'true' }}
                multiple
                aria-label="Select project files"
              />

              <AnimatePresence mode="wait">
                {isDragOver ? (
                  <motion.div
                    key="drag"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                  >
                    {dragType === 'zip' ? (
                      <FileArchive size={56} className="mx-auto text-accent-primary mb-4" />
                    ) : (
                      <FolderOpen size={56} className="mx-auto text-accent-primary mb-4" />
                    )}
                    <p className="text-lg font-medium text-accent-primary">Drop to upload</p>
                  </motion.div>
                ) : selectedFiles.length > 0 ? (
                  <motion.div
                    key="files"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <Check size={56} className="mx-auto text-green-400 mb-4" />
                    <p className="text-lg font-medium text-text-primary mb-1">
                      {selectedFiles.length === 1
                        ? selectedFiles[0].name
                        : `${selectedFiles.length} files selected`}
                    </p>
                    <p className="text-sm text-text-muted">{formatFileSize(totalSize)}</p>
                  </motion.div>
                ) : (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Upload size={56} className="mx-auto text-text-muted mb-4" />
                    <p className="text-lg font-medium text-text-primary mb-1">
                      Drop your project here
                    </p>
                    <p className="text-sm text-text-muted">
                      ZIP file or project files · Max 50MB
                    </p>
                    <p className="text-xs text-text-disabled mt-2">
                      Supports: .js .ts .jsx .tsx .py .go .java .rs .rb .php .cs .cpp
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Language breakdown */}
            {languageBreakdown.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex flex-wrap gap-2 justify-center"
              >
                {languageBreakdown.map(({ lang, count, color }) => (
                  <Badge key={lang} color={color} size="sm">
                    {lang}: {count} file{count > 1 ? 's' : ''}
                  </Badge>
                ))}
              </motion.div>
            )}

            {/* Validation error */}
            {selectedFiles.length > 0 && !hasSourceFiles && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2"
              >
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-400">
                  No recognized source files found. Please upload a project with at least one source file.
                </p>
              </motion.div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2"
              >
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </motion.div>
            )}

            {/* Buttons */}
            <div className="mt-6 flex gap-3 justify-center">
              <Button
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  folderInputRef.current?.click();
                }}
                icon={<FolderOpen size={16} />}
              >
                Browse Files
              </Button>
              <Button
                variant="primary"
                size="lg"
                disabled={selectedFiles.length === 0 || !hasSourceFiles}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAnalyze();
                }}
                icon={<ArrowRight size={16} />}
              >
                Analyze Project →
              </Button>
            </div>
          </>
        ) : (
          /* Processing State */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border-muted bg-surface p-8"
          >
            <h2 className="text-xl font-bold text-text-primary text-center mb-6">
              Analyzing Project...
            </h2>
            <div className="space-y-3 mb-6">
              {processingSteps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  {step.status === 'done' ? (
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Check size={12} className="text-green-400" />
                    </div>
                  ) : step.status === 'active' ? (
                    <div className="w-5 h-5 rounded-full border-2 border-accent-primary border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-border-muted" />
                  )}
                  <span
                    className={`text-sm ${
                      step.status === 'active'
                        ? 'text-text-primary font-medium'
                        : step.status === 'done'
                        ? 'text-text-secondary'
                        : 'text-text-disabled'
                    }`}
                  >
                    {step.label}
                  </span>
                </motion.div>
              ))}
            </div>
            <p className="text-center text-xs text-text-muted">
              Elapsed: {Math.round(elapsed)}ms
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
