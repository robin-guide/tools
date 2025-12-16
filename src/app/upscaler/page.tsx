'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import ImageViewer from '@/components/ImageViewer';
import SetupGuide from '@/components/SetupGuide';
import { useUpscaler } from '@/hooks/useUpscaler';
import { ImageData, UpscaleParams, HealthResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function UpscalerPage() {
  const [image, setImage] = useState<ImageData | null>(null);
  // SeedVR2 optimized defaults: faithful upscaling with no noise injection
  const [params, setParams] = useState<UpscaleParams>({
    scale: 2,
    denoise: 0,      // latent_noise_scale - 0 for faithful reproduction
    creativity: 0,   // not used by SeedVR2
    useMl: true,
    colorCorrection: 'none', // 'none' (fast), 'wavelet' (high), 'lab' (best)
  });
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [showSetup, setShowSetup] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  
  const { status, error, progress, result, upscale, reset, cancel, checkHealth } = useUpscaler();

  // Initial backend check
  useEffect(() => {
    checkHealth().then((h) => {
      setHealth(h);
      // If backend is connected and model is loaded, skip setup
      if (h?.status === 'healthy') {
        setShowSetup(false);
      }
      setInitialCheckDone(true);
    });
  }, [checkHealth]);

  // Poll health status when not in setup mode
  useEffect(() => {
    if (showSetup) return;
    
    const interval = setInterval(() => {
      checkHealth().then((newHealth) => {
        setHealth(newHealth);
        // If backend disconnects, show setup again
        if (!newHealth) {
          setShowSetup(true);
        }
      });
    }, 5000);
    
    return () => clearInterval(interval);
  }, [checkHealth, showSetup]);

  const handleSetupComplete = () => {
    setShowSetup(false);
    checkHealth().then(setHealth);
  };

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

  // Show loading state while checking
  if (!initialCheckDone) {
    return (
      <main className="min-h-screen grain-overlay flex items-center justify-center">
        <div className="fixed inset-0 bg-gradient-to-b from-stone-950 via-stone-950 to-stone-900 -z-10" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-8 h-8 mx-auto mb-4"
          >
            <svg className="w-8 h-8 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </motion.div>
          <p className="text-stone-500 text-sm">Checking backend...</p>
        </motion.div>
      </main>
    );
  }

  // Show setup guide if backend not connected
  if (showSetup) {
    return (
      <main className="min-h-screen grain-overlay">
        <div className="fixed inset-0 bg-gradient-to-b from-stone-950 via-stone-950 to-stone-900 -z-10" />
        <SetupGuide onComplete={handleSetupComplete} apiUrl={API_URL} />
      </main>
    );
  }

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
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="text-stone-500 hover:text-stone-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-display font-medium text-stone-100 tracking-tight">
              Upscaler
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Health indicator */}
            <button
              onClick={() => setShowSetup(true)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-colors
                ${health?.status === 'healthy' 
                  ? health.model_loaded 
                    ? 'bg-stone-800/50 hover:bg-stone-800 text-stone-400'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30'
                  : 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30'
                }
              `}
              title="Backend settings"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${
                health?.status === 'healthy' 
                  ? health.model_loaded 
                    ? 'bg-emerald-500' 
                    : health.model_loading 
                      ? 'bg-amber-500 animate-pulse' 
                      : 'bg-amber-500'
                  : 'bg-red-500 animate-pulse'
              }`} />
              {health?.status === 'healthy' ? (
                <>
                  {health.gpu_available ? health.device.toUpperCase() : 'CPU'} · 
                  {health.model_loaded 
                    ? health.model_type?.startsWith('seedvr2') 
                      ? ` SeedVR2 ${health.model_type.split('_')[1]?.toUpperCase() || ''}` 
                      : ' SD Upscaler'
                    : health.model_loading 
                      ? ' Loading ML...' 
                      : ' No AI (Lanczos only)'}
                </>
              ) : (
                'Not connected'
              )}
            </button>

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

        {/* Best Quality Warning */}
        <AnimatePresence>
          {params.colorCorrection === 'lab' && health?.model_type?.startsWith('seedvr2') && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-400">Best Quality Selected</h3>
                  <p className="text-xs text-blue-400/70 mt-1">
                    Maximum quality color correction is enabled. This will take approximately 16 minutes but produces the highest quality results.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ML Not Available Warning */}
        <AnimatePresence>
          {health?.status === 'healthy' && !health.model_loaded && !health.model_loading && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-amber-400">Using basic upscaling (Lanczos)</h3>
                  <p className="text-xs text-amber-400/70 mt-1">
                    AI upscaling is not available. The ML model may have failed to load or your system doesn't have enough resources.
                  </p>
                  <button
                    onClick={() => setShowSetup(true)}
                    className="mt-3 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
                  >
                    View setup guide →
                  </button>
                </div>
                <button
                  onClick={() => setShowSetup(true)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs text-amber-400 transition-colors"
                >
                  Fix this
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

            {/* Detail Variation Slider - only show if not using SeedVR2 or for advanced users */}
            {health?.model_type && !health.model_type.startsWith('seedvr2') && (
              <div className="flex items-center gap-3 flex-1 min-w-[160px]">
                <span className="text-sm text-stone-500 whitespace-nowrap" title="Adds variation to details (0 = faithful)">
                  Detail
                </span>
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
            )}

            {/* Creativity Slider - only for SD Upscaler, not SeedVR2 */}
            {health?.model_type && !health.model_type.startsWith('seedvr2') && (
              <div className="flex items-center gap-3 flex-1 min-w-[160px]">
                <span className="text-sm text-stone-500 whitespace-nowrap" title="AI hallucination level (0 = faithful)">
                  Creativity
                </span>
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
            )}

            {/* Quality Preset - only show for SeedVR2 */}
            {health?.model_type?.startsWith('seedvr2') && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-stone-500 whitespace-nowrap">Quality</span>
                <div className="flex gap-1">
                  {[
                    { label: 'Fast', value: 'none', desc: '~30s' },
                    { label: 'High', value: 'wavelet', desc: '~2min' },
                    { label: 'Best', value: 'lab', desc: '~16min' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setParams({ ...params, colorCorrection: preset.value })}
                      disabled={isProcessing}
                      className={`
                        px-3 py-1.5 rounded-lg text-sm transition-all relative group
                        ${params.colorCorrection === preset.value
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-stone-800/50 text-stone-500 border border-stone-800 hover:border-stone-700 hover:text-stone-400'
                        }
                        ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                      title={`${preset.desc} - ${preset.label === 'Fast' ? 'No color correction' : preset.label === 'High' ? 'Balanced quality' : 'Maximum quality with perceptual color matching'}`}
                    >
                      {preset.label}
                      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-stone-600 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {preset.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SeedVR2 info badge */}
            {health?.model_type?.startsWith('seedvr2') && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs text-emerald-400">SeedVR2 7B</span>
              </div>
            )}

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

