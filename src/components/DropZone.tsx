'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageData } from '@/types';

interface DropZoneProps {
  onImageSelect: (image: ImageData) => void;
  currentImage: ImageData | null;
  disabled?: boolean;
}

export default function DropZone({ onImageSelect, currentImage, disabled }: DropZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    
    // Get image dimensions
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
  }, [onImageSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxFiles: 1,
    disabled
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      <motion.div
        {...getRootProps()}
        className={`
          relative overflow-hidden rounded-xl
          border-2 border-dashed transition-colors duration-300
          ${isDragActive 
            ? 'border-stone-500 bg-stone-900/80' 
            : 'border-stone-700/50 bg-stone-900/30 hover:border-stone-600/50 hover:bg-stone-900/40'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${currentImage ? 'aspect-auto min-h-[280px]' : 'aspect-video min-h-[280px]'}
        `}
        whileHover={!disabled ? { scale: 1.005 } : {}}
        whileTap={!disabled ? { scale: 0.995 } : {}}
      >
        <input {...getInputProps()} />
        
        <AnimatePresence mode="wait">
          {currentImage ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative w-full h-full min-h-[280px] flex items-center justify-center p-4"
            >
              <img
                src={currentImage.preview}
                alt="Preview"
                className="max-w-full max-h-[400px] object-contain rounded-lg"
              />
              
              {/* Image info overlay */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="absolute bottom-4 left-4 right-4 flex justify-between items-end"
              >
                <div className="glass-panel px-3 py-2">
                  <p className="text-xs text-stone-400 font-mono">
                    {currentImage.dimensions?.width} × {currentImage.dimensions?.height}
                  </p>
                </div>
                <div className="glass-panel px-3 py-2">
                  <p className="text-xs text-stone-400 font-mono">
                    {formatSize(currentImage.size)}
                  </p>
                </div>
              </motion.div>

              {/* Replace hint */}
              <div className="absolute top-4 right-4 glass-panel px-3 py-2">
                <p className="text-xs text-stone-500">Drop to replace</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center p-8"
            >
              <motion.div
                animate={isDragActive ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="mb-6"
              >
                <svg
                  className="w-16 h-16 text-stone-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </motion.div>
              
              <p className="text-stone-400 text-center mb-2">
                {isDragActive ? 'Drop your image here' : 'Drop an image here'}
              </p>
              <p className="text-stone-600 text-sm">
                or click to browse
              </p>
              <p className="text-stone-700 text-xs mt-4">
                PNG, JPG, WEBP up to 10MB
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

