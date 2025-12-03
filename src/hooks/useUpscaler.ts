'use client';

import { useState, useCallback, useRef } from 'react';
import { UpscaleParams, ProcessingStatus, ImageData, HealthResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface UpscaleProgress {
  step: number;
  total: number;
  percent: number;
  preview?: string;
  message?: string;
}

export interface UpscaleResult {
  image: string;
  originalSize: [number, number];
  upscaledSize: [number, number];
  method?: string;
}

export function useUpscaler() {
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [error, setError] = useState<string | undefined>();
  const [progress, setProgress] = useState<UpscaleProgress | null>(null);
  const [result, setResult] = useState<UpscaleResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkHealth = useCallback(async (): Promise<HealthResponse | null> => {
    try {
      const res = await fetch(`${API_URL}/health`);
      if (!res.ok) throw new Error('Backend not available');
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  const upscale = useCallback(async (image: ImageData, params: UpscaleParams) => {
    // Abort any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setStatus('processing');
    setError(undefined);
    setProgress(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('image', image.file);
      formData.append('scale', params.scale.toString());
      formData.append('denoise', params.denoise.toString());
      formData.append('creativity', params.creativity.toString());
      formData.append('use_ml', params.useMl.toString());

      // Use the streaming endpoint
      const res = await fetch(`${API_URL}/upscale/stream`, {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      // Read the SSE stream
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'start':
                  setProgress({ step: 0, total: 100, percent: 0 });
                  break;
                  
                case 'progress':
                  setProgress({
                    step: data.step,
                    total: data.total,
                    percent: data.percent,
                    preview: data.preview,
                    message: data.message,
                  });
                  break;
                  
                case 'fallback':
                  // ML failed, falling back to Lanczos
                  setProgress({
                    step: 1,
                    total: 3,
                    percent: 33,
                    message: 'Using Lanczos fallback...',
                  });
                  break;
                  
                case 'complete':
                  setResult({
                    image: data.image,
                    originalSize: data.original_size,
                    upscaledSize: data.upscaled_size,
                    method: data.method,
                  });
                  setProgress(null);
                  setStatus('complete');
                  break;
                  
                case 'error':
                  throw new Error(data.error);
              }
            } catch (e) {
              // JSON parse error - ignore malformed events
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted, don't set error
        setStatus('idle');
        return;
      }
      
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setStatus('error');
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    setProgress(null);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setError(undefined);
    setResult(null);
  }, [cancel]);

  return {
    status,
    error,
    progress,
    result,
    upscale,
    reset,
    cancel,
    checkHealth,
  };
}
