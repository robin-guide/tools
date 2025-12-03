'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageData } from '@/types';
import { UpscaleProgress } from '@/hooks/useUpscaler';

type ViewMode = 'input' | 'output' | 'compare';

interface ImageViewerProps {
  original: ImageData | null;
  upscaled: string | null;
  originalSize?: [number, number];
  upscaledSize?: [number, number];
  method?: string;
  isProcessing?: boolean;
  progress?: UpscaleProgress | null;
  onImageSelect: (image: ImageData) => void;
  disabled?: boolean;
}

export default function ImageViewer({
  original,
  upscaled,
  originalSize,
  upscaledSize,
  method,
  isProcessing,
  progress,
  onImageSelect,
  disabled
}: ImageViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('input');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPanPoint = useRef({ x: 0, y: 0 });
  const isDraggingSlider = useRef(false);

  // Auto-switch to output when processing starts
  useEffect(() => {
    if (isProcessing && original) {
      setViewMode('output');
    }
  }, [isProcessing, original]);

  // Auto-switch to output when upscaled becomes available
  useEffect(() => {
    if (upscaled && viewMode === 'input') {
      setViewMode('output');
    }
  }, [upscaled, viewMode]);

  // Reset zoom/pan when image changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [original, upscaled]);


  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!upscaled && viewMode !== 'input' && !progress?.preview) return;
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(10, prev * delta)));
  }, [upscaled, viewMode, progress?.preview]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (viewMode === 'compare') {
      // In compare mode, only handle slider dragging
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const sliderX = rect.left + (rect.width * sliderPosition / 100);
        if (Math.abs(e.clientX - sliderX) < 30) {
          isDraggingSlider.current = true;
          e.preventDefault();
          return;
        }
      }
      // Allow panning in compare mode
      if (zoom > 1) {
        setIsPanning(true);
        lastPanPoint.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }
    
    if (zoom > 1) {
      setIsPanning(true);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
    }
  }, [zoom, viewMode, sliderPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingSlider.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      setSliderPosition(Math.max(5, Math.min(95, x)));
      return;
    }

    if (isPanning && zoom > 1) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  }, [isPanning, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    isDraggingSlider.current = false;
  }, []);

  const handleZoomIn = () => setZoom(prev => Math.min(10, prev * 1.5));
  const handleZoomOut = () => setZoom(prev => Math.max(0.5, prev / 1.5));
  const handleResetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (viewMode === 'compare') return; // Don't allow drops in compare mode
    const file = e.dataTransfer.files[0];
    if (!file || disabled) return;
    
    const preview = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      onImageSelect({
        file,
        preview,
        name: file.name,
        size: file.size,
        dimensions: { width: img.width, height: img.height }
      });
    };
    img.src = preview;
  }, [onImageSelect, disabled, viewMode]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || disabled) return;
    
    const preview = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      onImageSelect({
        file,
        preview,
        name: file.name,
        size: file.size,
        dimensions: { width: img.width, height: img.height }
      });
    };
    img.src = preview;
  }, [onImageSelect, disabled]);

  const handleDownload = () => {
    if (!upscaled) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${upscaled}`;
    link.download = `upscaled-${original?.name || 'image'}.png`;
    link.click();
  };

  // Determine what image to show
  const previewImage = progress?.preview ? `data:image/jpeg;base64,${progress.preview}` : null;
  const currentImage = viewMode === 'input' 
    ? original?.preview 
    : viewMode === 'output' 
      ? (upscaled ? `data:image/png;base64,${upscaled}` : previewImage)
      : null;

  const showEmptyState = !original;
  const showProcessingState = viewMode === 'output' && isProcessing && !upscaled;
  const showUpscaledPlaceholder = viewMode === 'output' && !upscaled && !isProcessing && original;
  const isCompareMode = viewMode === 'compare';

  return (
    <div className="space-y-4">
      {/* View Mode Tabs + Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg bg-stone-900/50">
          {(['input', 'output', 'compare'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              disabled={(mode === 'compare' && !upscaled) || (mode === 'output' && !original)}
              className={`
                px-4 py-2 text-sm rounded-md transition-all capitalize
                ${viewMode === mode
                  ? 'bg-stone-800 text-stone-200 shadow-sm'
                  : 'text-stone-500 hover:text-stone-400'
                }
                disabled:opacity-30 disabled:cursor-not-allowed
              `}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          {(original || upscaled || previewImage) && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-900/50">
              <button
                onClick={handleZoomOut}
                className="p-1.5 transition-colors text-stone-400 hover:text-stone-200"
                title="Zoom out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button
                onClick={handleResetZoom}
                className="px-2 py-1 text-xs font-mono transition-colors min-w-[50px] text-stone-400 hover:text-stone-200"
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1.5 transition-colors text-stone-400 hover:text-stone-200"
                title="Zoom in"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          )}

          {/* Download */}
          {upscaled && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-lg text-sm text-stone-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          )}
        </div>
      </div>

      {/* Main Viewer */}
      <div
        ref={containerRef}
        className={`
          relative overflow-hidden bg-stone-900/50 border border-stone-800/50 rounded-xl
          ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}
          ${showEmptyState ? 'cursor-pointer hover:border-stone-700/50' : ''}
          ${isCompareMode ? 'select-none' : ''}
        `}
        style={{ 
          height: isCompareMode ? 'calc(100vh - 120px)' : '60vh', 
          minHeight: isCompareMode ? '600px' : '400px' 
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <AnimatePresence mode="wait">
          {/* Empty State - Drop Zone */}
          {showEmptyState && !isCompareMode && (
            <motion.label
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled}
              />
              <div className="mb-6">
                <svg className="w-16 h-16 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-stone-400 mb-2">Drop an image here</p>
              <p className="text-stone-600 text-sm">or click to browse</p>
              <p className="text-stone-700 text-xs mt-4">PNG, JPG, WEBP up to 10MB</p>
            </motion.label>
          )}

          {/* Processing State with Preview */}
          {showProcessingState && (
            <motion.div
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              {previewImage ? (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: 'center',
                  }}
                >
                  <img
                    src={previewImage}
                    alt="Processing preview"
                    className="max-w-full max-h-full object-contain"
                    draggable={false}
                    style={{ filter: 'brightness(0.9)' }}
                  />
                </div>
              ) : (
                <div className="w-20 h-20 mb-4 rounded-full bg-stone-800/50 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <svg className="w-10 h-10 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </motion.div>
                </div>
              )}
              
              {/* Progress overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <div className="max-w-md mx-auto">
                  <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden mb-2">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress?.percent || 0}%` }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">
                      {progress?.message || (
                        progress?.total 
                          ? `Step ${progress.step} of ${progress.total}` 
                          : 'Initializing...'
                      )}
                    </span>
                    <span className="font-mono text-stone-500">
                      {progress?.percent || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Waiting for upscale */}
          {showUpscaledPlaceholder && (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <div className="w-16 h-16 mb-4 rounded-full bg-stone-800/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
              <p className="text-stone-500">Click Upscale to process</p>
            </motion.div>
          )}

          {/* Compare View */}
          {isCompareMode && original && upscaled && (
            <motion.div
              key="compare"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 select-none"
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              {/* Upscaled (full - right side) */}
              <div
                className="absolute inset-0 flex items-center justify-center select-none"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                  transformOrigin: 'center',
                  userSelect: 'none',
                }}
              >
                <img
                  src={`data:image/png;base64,${upscaled}`}
                  alt="Upscaled"
                  className="max-w-full max-h-full object-contain pointer-events-none"
                  draggable={false}
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                />
              </div>
              
              {/* Original (clipped - left side) */}
              <div
                className="absolute inset-0 overflow-hidden select-none"
                style={{ width: `${sliderPosition}%`, userSelect: 'none' }}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    width: `${sliderPosition > 0 ? (100 / sliderPosition * 100) : 100}%`,
                    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                    transformOrigin: 'center',
                    userSelect: 'none',
                  }}
                >
                  <img
                    src={original.preview}
                    alt="Original"
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    draggable={false}
                    style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                  />
                </div>
              </div>

              {/* Slider handle */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white/90 cursor-col-resize z-10 shadow-lg"
                style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center cursor-col-resize">
                  <svg className="w-5 h-5 text-stone-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                </div>
              </div>

              {/* Labels */}
              <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-md z-10">
                <span className="text-xs font-mono text-white">Original</span>
              </div>
              <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-md z-10">
                <span className="text-xs font-mono text-white">Upscaled</span>
              </div>
            </motion.div>
          )}

          {/* Single Image View (Input or Output) */}
          {viewMode !== 'compare' && currentImage && !showProcessingState && (
            <motion.div
              key={viewMode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transformOrigin: 'center',
              }}
            >
              <img
                src={currentImage}
                alt={viewMode === 'input' ? 'Original' : 'Upscaled'}
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Info Overlay */}
        {original && viewMode === 'input' && (
          <div className="absolute bottom-4 left-4 right-4 flex justify-between pointer-events-none">
            <div className="px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-md">
              <span className="text-xs font-mono text-white">
                {original.dimensions?.width} × {original.dimensions?.height}
              </span>
            </div>
            <div className="px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-md">
              <span className="text-xs font-mono text-white">
                {(original.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          </div>
        )}

        {upscaled && viewMode === 'output' && upscaledSize && !isProcessing && (
          <div className="absolute bottom-4 left-4 right-4 flex justify-between pointer-events-none">
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-md">
                <span className="text-xs font-mono text-white">
                  {upscaledSize[0]} × {upscaledSize[1]}
                </span>
              </div>
              {method && (
                <div className={`px-3 py-1.5 backdrop-blur-sm rounded-md ${
                  method === 'ml' ? 'bg-violet-500/30' : 'bg-stone-500/30'
                }`}>
                  <span className={`text-xs font-mono ${
                    method === 'ml' ? 'text-violet-300' : 'text-stone-300'
                  }`}>
                    {method === 'ml' ? '✨ AI Enhanced' : method}
                  </span>
                </div>
              )}
            </div>
            <div className="px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-md">
              <span className="text-xs font-mono text-emerald-400">
                {((upscaledSize[0] * upscaledSize[1]) / (originalSize?.[0] || 1) / (originalSize?.[1] || 1)).toFixed(0)}× larger
              </span>
            </div>
          </div>
        )}

        {/* Zoom hint */}
        {(original || upscaled) && zoom === 1 && !isProcessing && !isCompareMode && (
          <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/30 backdrop-blur-sm rounded-md pointer-events-none">
            <span className="text-xs text-white/50">Scroll to zoom · Drag to pan</span>
          </div>
        )}
      </div>
    </div>
  );
}
