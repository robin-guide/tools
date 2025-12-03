'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageData } from '@/types';

interface ResultViewerProps {
  original: ImageData | null;
  upscaled: string | null;
  originalSize?: [number, number];
  upscaledSize?: [number, number];
}

export default function ResultViewer({ 
  original, 
  upscaled, 
  originalSize, 
  upscaledSize 
}: ResultViewerProps) {
  const [viewMode, setViewMode] = useState<'side' | 'slider'>('slider');
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, x)));
  };

  const handleDownload = () => {
    if (!upscaled) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${upscaled}`;
    link.download = `upscaled-${original?.name || 'image'}.png`;
    link.click();
  };

  if (!original || !upscaled) {
    return (
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-stone-700/50 bg-stone-900/30 min-h-[280px] flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 mb-4 rounded-full bg-stone-800/50 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-stone-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
            />
          </svg>
        </div>
        <p className="text-stone-500 text-center">
          Upscaled result will appear here
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* View Mode Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          {(['slider', 'side'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`
                px-3 py-1.5 text-xs rounded-md transition-colors
                ${viewMode === mode
                  ? 'bg-stone-800 text-stone-300'
                  : 'text-stone-500 hover:text-stone-400'
                }
              `}
            >
              {mode === 'slider' ? 'Compare' : 'Side by Side'}
            </button>
          ))}
        </div>
        
        <button
          onClick={handleDownload}
          className="btn-primary text-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download
        </button>
      </div>

      {/* Image Display */}
      <AnimatePresence mode="wait">
        {viewMode === 'slider' ? (
          <motion.div
            key="slider"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={containerRef}
            className="relative aspect-video rounded-xl overflow-hidden cursor-col-resize select-none"
            onMouseDown={() => { isDragging.current = true; }}
            onMouseUp={() => { isDragging.current = false; }}
            onMouseLeave={() => { isDragging.current = false; }}
            onMouseMove={handleMouseMove}
          >
            {/* Upscaled (background) */}
            <img
              src={`data:image/png;base64,${upscaled}`}
              alt="Upscaled"
              className="absolute inset-0 w-full h-full object-contain bg-stone-900"
            />
            
            {/* Original (clipped) */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPosition}%` }}
            >
              <img
                src={original.preview}
                alt="Original"
                className="absolute inset-0 w-full h-full object-contain bg-stone-900"
                style={{ 
                  width: `${100 / sliderPosition * 100}%`,
                  maxWidth: 'none'
                }}
              />
            </div>

            {/* Slider Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-lg"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-stone-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>
            </div>

            {/* Labels */}
            <div className="absolute bottom-4 left-4 glass-panel px-3 py-1.5">
              <span className="text-xs font-mono text-stone-400">Original</span>
            </div>
            <div className="absolute bottom-4 right-4 glass-panel px-3 py-1.5">
              <span className="text-xs font-mono text-stone-400">Upscaled</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="side"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden bg-stone-900 aspect-video flex items-center justify-center">
                <img
                  src={original.preview}
                  alt="Original"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="flex justify-between text-xs text-stone-500 font-mono">
                <span>Original</span>
                {originalSize && <span>{originalSize[0]}×{originalSize[1]}</span>}
              </div>
            </div>
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden bg-stone-900 aspect-video flex items-center justify-center">
                <img
                  src={`data:image/png;base64,${upscaled}`}
                  alt="Upscaled"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <div className="flex justify-between text-xs text-stone-500 font-mono">
                <span>Upscaled</span>
                {upscaledSize && <span>{upscaledSize[0]}×{upscaledSize[1]}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

