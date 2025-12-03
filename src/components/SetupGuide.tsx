'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  command?: string;
  check: () => Promise<boolean>;
}

interface SetupGuideProps {
  onComplete: () => void;
  apiUrl: string;
}

export default function SetupGuide({ onComplete, apiUrl }: SetupGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStatus, setStepStatus] = useState<Record<string, 'pending' | 'checking' | 'complete' | 'error'>>({});
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

  // Define setup steps
  const steps: SetupStep[] = [
    {
      id: 'clone',
      title: 'Get the code',
      description: 'Clone the repository to your machine',
      command: 'git clone https://github.com/robin-guide/tools.git && cd tools',
      check: async () => true, // Manual confirmation
    },
    {
      id: 'python',
      title: 'Set up Python environment',
      description: 'Create a virtual environment and install dependencies',
      command: 'cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt',
      check: async () => true, // Manual confirmation
    },
    {
      id: 'start',
      title: 'Start the backend',
      description: 'Run the FastAPI server (this will download the ML model on first run)',
      command: 'cd backend && source venv/bin/activate && python main.py',
      check: checkBackend,
    },
    {
      id: 'ready',
      title: 'Wait for model to load',
      description: 'The ML model (~5GB) will download and load automatically',
      check: async () => {
        const connected = await checkBackend();
        return connected && backendHealth?.modelLoaded === true;
      },
    },
  ];

  // Poll for backend connection
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(async () => {
      const connected = await checkBackend();
      
      if (connected) {
        setStepStatus(prev => ({ ...prev, start: 'complete' }));
        
        if (backendHealth?.modelLoaded) {
          setStepStatus(prev => ({ ...prev, ready: 'complete' }));
          setIsPolling(false);
          
          // Auto-complete after a moment
          setTimeout(() => {
            onComplete();
          }, 1500);
        } else if (backendHealth?.modelLoading) {
          setCurrentStep(3); // Move to "loading model" step
        }
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
  }, []);

  const copyCommand = (command: string, id: string) => {
    navigator.clipboard.writeText(command);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleStepComplete = (stepId: string) => {
    setStepStatus(prev => ({ ...prev, [stepId]: 'complete' }));
    
    const stepIndex = steps.findIndex(s => s.id === stepId);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(stepIndex + 1);
    }
    
    // Start polling when they get to the "start" step
    if (stepId === 'python') {
      setIsPolling(true);
    }
  };

  const getStepIcon = (step: SetupStep, index: number) => {
    const status = stepStatus[step.id];
    
    if (status === 'complete') {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      );
    }
    
    if (status === 'checking' || (step.id === 'ready' && backendHealth?.modelLoading)) {
      return (
        <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </motion.div>
        </div>
      );
    }
    
    if (index === currentStep) {
      return (
        <div className="w-8 h-8 rounded-full bg-stone-700 border-2 border-stone-500 flex items-center justify-center">
          <span className="text-sm font-mono text-stone-300">{index + 1}</span>
        </div>
      );
    }
    
    return (
      <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center">
        <span className="text-sm font-mono text-stone-600">{index + 1}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full"
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
            Set Up AI Upscaler
          </h1>
          <p className="text-stone-400 max-w-md mx-auto">
            Run the backend locally to enable AI-powered upscaling. 
            This requires Python and will use your GPU if available.
          </p>
        </div>

        {/* Connection Status */}
        <div className={`
          mb-8 p-4 rounded-xl border flex items-center gap-4
          ${backendHealth?.connected 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-stone-800/50 border-stone-700/50'
          }
        `}>
          <div className={`
            w-3 h-3 rounded-full
            ${backendHealth?.connected 
              ? 'bg-emerald-500' 
              : 'bg-stone-600 animate-pulse'
            }
          `} />
          <div className="flex-1">
            <p className={`text-sm font-medium ${backendHealth?.connected ? 'text-emerald-400' : 'text-stone-400'}`}>
              {backendHealth?.connected 
                ? backendHealth.modelLoaded 
                  ? `✓ Connected · ${backendHealth.device.toUpperCase()} · ML Ready`
                  : backendHealth.modelLoading
                    ? `Connected · Loading ML model...`
                    : `Connected · Waiting for model`
                : 'Backend not connected'
              }
            </p>
            <p className="text-xs text-stone-500 mt-0.5">
              {apiUrl}
            </p>
          </div>
          {isPolling && !backendHealth?.connected && (
            <span className="text-xs text-stone-500">Listening...</span>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isComplete = stepStatus[step.id] === 'complete';
            const isPast = index < currentStep || isComplete;
            
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`
                  p-4 rounded-xl border transition-all
                  ${isActive 
                    ? 'bg-stone-800/80 border-stone-600' 
                    : isPast
                      ? 'bg-stone-900/50 border-stone-800/50'
                      : 'bg-stone-900/30 border-stone-800/30 opacity-50'
                  }
                `}
              >
                <div className="flex items-start gap-4">
                  {getStepIcon(step, index)}
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium ${isPast ? 'text-stone-500' : 'text-stone-200'}`}>
                      {step.title}
                    </h3>
                    <p className="text-sm text-stone-500 mt-1">
                      {step.description}
                    </p>
                    
                    {/* Command block */}
                    {step.command && isActive && !isComplete && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3"
                      >
                        <div className="relative group">
                          <pre className="bg-stone-950 border border-stone-800 rounded-lg p-3 pr-12 overflow-x-auto">
                            <code className="text-sm text-emerald-400 font-mono">
                              {step.command}
                            </code>
                          </pre>
                          <button
                            onClick={() => copyCommand(step.command!, step.id)}
                            className="absolute right-2 top-2 p-2 rounded-md bg-stone-800 hover:bg-stone-700 transition-colors"
                            title="Copy command"
                          >
                            {copied === step.id ? (
                              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        
                        <button
                          onClick={() => handleStepComplete(step.id)}
                          className="mt-3 px-4 py-2 bg-stone-700 hover:bg-stone-600 rounded-lg text-sm text-stone-200 transition-colors"
                        >
                          I've done this →
                        </button>
                      </motion.div>
                    )}
                    
                    {/* Loading state for model */}
                    {step.id === 'ready' && isActive && backendHealth?.modelLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-3 p-3 bg-violet-500/10 border border-violet-500/30 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          >
                            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </motion.div>
                          <div>
                            <p className="text-sm text-violet-300">Downloading ML model...</p>
                            <p className="text-xs text-violet-400/60">This may take a few minutes on first run</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Success state */}
        <AnimatePresence>
          {backendHealth?.modelLoaded && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center"
            >
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-emerald-400 mb-2">All set!</h3>
              <p className="text-sm text-emerald-400/70">Redirecting to upscaler...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Help link */}
        <p className="text-center text-sm text-stone-600 mt-8">
          Having trouble?{' '}
          <a 
            href="https://github.com/robin-guide/tools#quick-start" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-400 hover:text-stone-300 underline"
          >
            View full setup guide
          </a>
        </p>
      </motion.div>
    </div>
  );
}

