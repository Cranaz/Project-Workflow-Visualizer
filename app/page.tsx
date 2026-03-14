'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UploadZone } from '@/components/upload/UploadZone';
import { useWorkflowStore } from '@/lib/store/workflowStore';

export default function HomePage() {
  const router = useRouter();
  const uploadState = useWorkflowStore((s) => s.uploadState);
  const parsedProject = useWorkflowStore((s) => s.parsedProject);

  useEffect(() => {
    if (parsedProject) {
      router.push('/analyze');
      return;
    }
    if (uploadState === 'success') {
      // Delay slightly for the final progress animation
      const timer = setTimeout(() => {
        router.push('/analyze');
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [uploadState, parsedProject, router]);

  return (
    <main>
      <UploadZone />
    </main>
  );
}
