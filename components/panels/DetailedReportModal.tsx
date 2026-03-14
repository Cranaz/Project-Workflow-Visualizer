import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, AlertTriangle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AiStatus } from '@/lib/types/project';

interface DetailedReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportContent: string;
  projectName: string;
  aiStatus?: AiStatus;
  aiDetail?: string | null;
}

export function DetailedReportModal({
  isOpen,
  onClose,
  reportContent,
  projectName,
  aiStatus,
  aiDetail,
}: DetailedReportModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 z-50 md:inset-10 lg:inset-x-32 lg:inset-y-12 bg-surface border border-border-subtle rounded-xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-elevated shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="text-accent-primary" size={24} />
                <div>
                  <h2 className="text-lg font-bold text-text-primary">Full Project Overview</h2>
                  <p className="text-xs text-text-muted">{projectName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-surface text-text-muted hover:text-text-primary transition-colors"
                aria-label="Close report"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-base">
              <div className="max-w-5xl mx-auto prose prose-invert prose-emerald prose-base md:prose-lg prose-pre:bg-overlay prose-pre:border prose-pre:border-border-subtle prose-headings:text-text-primary text-text-secondary leading-relaxed space-y-4">
                {reportContent ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {reportContent}
                  </ReactMarkdown>
                ) : (
                  <div className="bg-elevated/60 border border-border-subtle rounded-lg p-4 text-sm text-text-secondary">
                    <div className="flex items-center gap-2 text-text-muted mb-2">
                      <AlertTriangle size={16} />
                      <span className="font-semibold">Generating AI overview...</span>
                    </div>
                    <p className="text-[13px] text-text-secondary">
                      The full 10K-word overview is generated in the background and will appear automatically
                      as soon as it is ready.
                    </p>
                    {aiStatus && (
                      <p className="mt-2 text-[12px] text-text-muted">
                        Status: {aiStatus}
                      </p>
                    )}
                    {aiDetail && (
                      <p className="mt-1 text-[12px] text-text-muted">
                        {aiDetail}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
