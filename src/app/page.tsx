'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageViewer from '@/components/ImageViewer';
import { useUpscaler } from '@/hooks/useUpscaler';
import { ImageData, UpscaleParams, HealthResponse } from '@/types';

export default function Home() {
  const [image, setImage] = useState<ImageData | null>(null);
  const [params, setParams] = useState<UpscaleParams>({
    scale: 2,
    denoise: 0.3,
    creativity: 0,
    useMl: true,
  });
  const [health, setHealth] = useState<HealthResponse | null>(null);
  
  const { status, error, progress, result, upscale, reset, cancel, checkHealth } = useUpscaler();

  // Poll health status to track ML model loading
  useEffect(() => {
    checkHealth().then(setHealth);
    
    const interval = setInterval(() => {
      checkHealth().then((newHealth) => {
        setHealth(newHealth);
        if (newHealth?.model_loaded || (newHealth && !newHealth.model_loading)) {
          clearInterval(interval);
        }
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, [checkHealth]);

  const handleImageSelect = (newImage: ImageData) => {
    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }
    setImage(newImage);
    reset();
  };

  const handleUpscale = () => {
    if (!image) return;
    upscale(image, params);
  };

  const handleClear = () => {
    if (image?.preview) {
      URL.revokeObjectURL(image.preview);
    }
    setImage(null);
    reset();
  };

  const isProcessing = status === 'processing';

  return (
    <main className="min-h-screen grain-overlay">
      <div className="fixed inset-0 bg-gradient-to-b from-stone-950 via-stone-950 to-stone-900 -z-10" />
      
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="text-2xl font-display font-medium text-stone-100 tracking-tight">
              Upscaler
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Health indicator */}
            <div className={`
              flex items-center gap-2 px-3 py-1.5 rounded-full text-xs
              bg-stone-800/50 
              ${health?.status === 'healthy' ? 'text-stone-400' : 'text-stone-500'}
            `}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                health?.status === 'healthy' 
                  ? health.model_loaded 
                    ? 'bg-emerald-500' 
                    : health.model_loading 
                      ? 'bg-amber-500 animate-pulse' 
                      : 'bg-stone-500'
                  : 'bg-stone-600 animate-pulse'
              }`} />
              {health?.status === 'healthy' ? (
                <>
                  {health.gpu_available ? health.device.toUpperCase() : 'CPU'} · 
                  {health.model_loaded 
                    ? ' ML Ready' 
                    : health.model_loading 
                      ? ' Loading model...' 
                      : ' Lanczos'}
                </>
              ) : (
                'Connecting...'
              )}
            </div>

            {/* Clear button */}
            {image && (
              <button
                onClick={handleClear}
                className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </motion.header>

        {/* Main Content */}
        <div className="space-y-6">
          {/* Unified Image Viewer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ImageViewer
              original={image}
              upscaled={result?.image || null}
              originalSize={result?.originalSize}
              upscaledSize={result?.upscaledSize}
              method={result?.method}
              isProcessing={isProcessing}
              progress={progress}
              onImageSelect={handleImageSelect}
              disabled={isProcessing}
            />
          </motion.div>

          {/* Controls Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center gap-6 p-4 bg-stone-900/30 border border-stone-800/50 rounded-xl"
          >
            {/* Scale Factor - only show before upscaling */}
            {!result && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-stone-500">Scale</span>
                <div className="flex gap-1">
                  {[2, 3, 4].map((scale) => (
                    <button
                      key={scale}
                      onClick={() => setParams({ ...params, scale })}
                      disabled={isProcessing}
                      className={`
                        px-4 py-2 rounded-lg font-mono text-sm transition-all
                        ${params.scale === scale
                          ? 'bg-stone-700 text-stone-200 border border-stone-600'
                          : 'bg-stone-800/50 text-stone-500 border border-stone-800 hover:border-stone-700 hover:text-stone-400'
                        }
                        ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      {scale}×
                    </button>
                  ))}
                </div>
              </div>
            )}

                {/* Enhancement Slider */}
                <div className="flex items-center gap-3 flex-1 min-w-[160px]">
                  <span className="text-sm text-stone-500 whitespace-nowrap">Enhance</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={params.denoise * 100}
                    onChange={(e) => setParams({ ...params, denoise: parseInt(e.target.value) / 100 })}
                    disabled={isProcessing}
                    className={`
                      flex-1 h-2 rounded-full appearance-none cursor-pointer bg-stone-800
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-stone-400
                      [&::-webkit-slider-thumb]:hover:bg-stone-300 [&::-webkit-slider-thumb]:transition-colors
                      ${isProcessing ? 'opacity-50' : ''}
                    `}
                  />
                  <span className="text-xs font-mono text-stone-600 w-10 text-right">
                    {Math.round(params.denoise * 100)}%
                  </span>
                </div>

                {/* Creativity Slider */}
                <div className="flex items-center gap-3 flex-1 min-w-[160px]">
                  <span className="text-sm text-stone-500 whitespace-nowrap">Creativity</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={params.creativity * 100}
                    onChange={(e) => setParams({ ...params, creativity: parseInt(e.target.value) / 100 })}
                    disabled={isProcessing}
                    className={`
                      flex-1 h-2 rounded-full appearance-none cursor-pointer bg-stone-800
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400
                      [&::-webkit-slider-thumb]:hover:bg-violet-300 [&::-webkit-slider-thumb]:transition-colors
                      ${isProcessing ? 'opacity-50' : ''}
                    `}
                  />
                  <span className="text-xs font-mono text-stone-600 w-10 text-right">
                    {Math.round(params.creativity * 100)}%
                  </span>
                </div>

                {/* Upscale / Cancel Button */}
                {isProcessing ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={cancel}
                    className="px-8 py-3 rounded-lg font-medium flex items-center gap-3 transition-all bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={image ? { scale: 1.02 } : {}}
                    whileTap={image ? { scale: 0.98 } : {}}
                    onClick={handleUpscale}
                    disabled={!image}
                    className={`
                      px-8 py-3 rounded-lg font-medium flex items-center gap-3 transition-all
                      ${!image
                        ? 'bg-stone-800/50 text-stone-600 cursor-not-allowed'
                        : 'bg-stone-200 text-stone-900 hover:bg-white'
                      }
                    `}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    Upscale
              </motion.button>
            )}
          </motion.div>

          {/* Error display */}
          <AnimatePresence>
            {status === 'error' && error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
