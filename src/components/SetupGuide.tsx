'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SetupGuideProps {
  onComplete: () => void;
  apiUrl: string;
}

export default function SetupGuide({ onComplete, apiUrl }: SetupGuideProps) {
  const [showDevSetup, setShowDevSetup] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStatus, setStepStatus] = useState<Record<string, 'pending' | 'complete'>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [backendHealth, setBackendHealth] = useState<{
    connected: boolean;
    modelLoaded: boolean;
    modelLoading: boolean;
    device: string;
  } | null>(null);

  // Check backend health
  const checkBackend = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/health`, { 
        signal: AbortSignal.timeout(3000) 
      });
      if (res.ok) {
        const data = await res.json();
        setBackendHealth({
          connected: true,
          modelLoaded: data.model_loaded,
          modelLoading: data.model_loading,
          device: data.device,
        });
        return true;
      }
    } catch {
      setBackendHealth(null);
    }
    return false;
  }, [apiUrl]);

  // Poll for backend connection
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      const connected = await checkBackend();
      
      if (connected && backendHealth?.modelLoaded) {
        setIsPolling(false);
        setTimeout(() => onComplete(), 1500);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPolling, checkBackend, backendHealth, onComplete]);

  // Initial check
  useEffect(() => {
    checkBackend().then(connected => {
      if (connected && backendHealth?.modelLoaded) {
        onComplete();
      }
    });
    // Start polling immediately
    setIsPolling(true);
  }, []);

  const copyCommand = (command: string, id: string) => {
    navigator.clipboard.writeText(command);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleStepComplete = (stepId: string) => {
    setStepStatus(prev => ({ ...prev, [stepId]: 'complete' }));
    setCurrentStep(prev => prev + 1);
  };

  const devSteps = [
    {
      id: 'clone',
      title: 'Clone the repo',
      command: 'git clone https://github.com/robin-guide/tools.git && cd tools',
    },
    {
      id: 'setup',
      title: 'Set up Python',
      command: 'cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt',
    },
    {
      id: 'run',
      title: 'Start the backend',
      command: 'python main.py',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg w-full"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center"
          >
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </motion.div>
          
          <h1 className="text-3xl font-display font-medium text-stone-100 mb-3">
            One more step
          </h1>
          <p className="text-stone-400">
            Download the app to run AI upscaling on your Mac.
          </p>
        </div>

        {/* Connection Status */}
        <AnimatePresence>
          {backendHealth?.connected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-sm font-medium text-emerald-400">
                    {backendHealth.modelLoaded 
                      ? '✓ Connected and ready!'
                      : backendHealth.modelLoading
                        ? 'Connected · Loading ML model...'
                        : 'Connected · Initializing...'
                    }
                  </p>
                  {backendHealth.modelLoaded && (
                    <p className="text-xs text-emerald-400/70 mt-0.5">Redirecting to upscaler...</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Download Section */}
        {!backendHealth?.connected && (
          <div className="space-y-4">
            {/* Big Download Button */}
            <motion.a
              href="https://github.com/robin-guide/tools/releases/latest/download/Robin-Tools-macOS.zip"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="block w-full p-6 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-white">Download for Mac</p>
                    <p className="text-sm text-white/70">macOS 10.15+</p>
                  </div>
                </div>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
            </motion.a>

            {/* Instructions */}
            <div className="p-5 rounded-xl bg-stone-900/50 border border-stone-800/50">
              <p className="text-sm text-stone-300 mb-4">After downloading:</p>
              <ol className="space-y-3 text-sm text-stone-400">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center text-xs text-stone-300">1</span>
                  <span>Unzip the file</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center text-xs text-stone-300">2</span>
                  <div>
                    <span><strong className="text-stone-200">Right-click</strong> Robin Tools.app → select <strong className="text-stone-200">"Open"</strong></span>
                    <p className="text-xs text-stone-500 mt-1">First time only — macOS requires this for new apps</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center text-xs text-stone-300">3</span>
                  <span>Click "Open" when prompted, then wait for setup</span>
                </li>
              </ol>
            </div>

            {/* Listening indicator */}
            <div className="flex items-center justify-center gap-2 py-3">
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-stone-500"
              />
              <span className="text-xs text-stone-500">
                This page will update when the app connects
              </span>
            </div>
          </div>
        )}

        {/* Developer Setup (Collapsible) */}
        {!backendHealth?.connected && (
          <div className="mt-8 pt-6 border-t border-stone-800/50">
            <button
              onClick={() => setShowDevSetup(!showDevSetup)}
              className="w-full flex items-center justify-between text-stone-500 hover:text-stone-400 transition-colors"
            >
              <span className="text-sm">Prefer using Terminal?</span>
              <motion.svg
                animate={{ rotate: showDevSetup ? 180 : 0 }}
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </motion.svg>
            </button>

            <AnimatePresence>
              {showDevSetup && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 space-y-3">
                    {devSteps.map((step, index) => {
                      const isActive = index === currentStep;
                      const isComplete = stepStatus[step.id] === 'complete';
                      const isPast = index < currentStep;
                      
                      return (
                        <div
                          key={step.id}
                          className={`p-3 rounded-lg border transition-all ${
                            isActive 
                              ? 'bg-stone-800/50 border-stone-700' 
                              : isComplete || isPast
                                ? 'bg-stone-900/30 border-stone-800/30'
                                : 'bg-stone-900/20 border-stone-800/20 opacity-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                              isComplete ? 'bg-emerald-500 text-white' : 'bg-stone-700 text-stone-400'
                            }`}>
                              {isComplete ? '✓' : index + 1}
                            </div>
                            <span className={`text-sm ${isComplete ? 'text-stone-500' : 'text-stone-300'}`}>
                              {step.title}
                            </span>
                          </div>
                          
                          {isActive && (
                            <div className="ml-8">
                              <div className="relative">
                                <pre className="bg-stone-950 border border-stone-800 rounded p-2 pr-10 overflow-x-auto">
                                  <code className="text-xs text-emerald-400 font-mono">
                                    {step.command}
                                  </code>
                                </pre>
                                <button
                                  onClick={() => copyCommand(step.command, step.id)}
                                  className="absolute right-1 top-1 p-1.5 rounded bg-stone-800 hover:bg-stone-700 transition-colors"
                                >
                                  {copied === step.id ? (
                                    <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3 h-3 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                              <button
                                onClick={() => handleStepComplete(step.id)}
                                className="mt-2 text-xs text-stone-400 hover:text-stone-300"
                              >
                                Done →
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Help link */}
        <p className="text-center text-xs text-stone-600 mt-8">
          Need help?{' '}
          <a 
            href="https://github.com/robin-guide/tools/issues" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-500 hover:text-stone-400 underline"
          >
            Open an issue
          </a>
        </p>
      </motion.div>
    </div>
  );
}
