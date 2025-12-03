'use client';

import { motion } from 'framer-motion';
import { ProcessingStatus } from '@/types';

interface StatusIndicatorProps {
  status: ProcessingStatus;
  error?: string;
}

export default function StatusIndicator({ status, error }: StatusIndicatorProps) {
  if (status === 'idle') return null;

  const statusConfig = {
    uploading: {
      text: 'Uploading...',
      color: 'bg-stone-500',
    },
    processing: {
      text: 'Upscaling...',
      color: 'bg-amber-500/80',
    },
    complete: {
      text: 'Complete',
      color: 'bg-emerald-500/80',
    },
    error: {
      text: error || 'Error occurred',
      color: 'bg-red-500/80',
    },
  };

  const config = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-3 px-4 py-2 rounded-lg bg-stone-900/50 border border-stone-800/50"
    >
      {status === 'processing' ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-4 h-4 border-2 border-stone-600 border-t-stone-300 rounded-full"
        />
      ) : (
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
      )}
      <span className="text-sm text-stone-400">{config.text}</span>
    </motion.div>
  );
}

