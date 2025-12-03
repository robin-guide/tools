'use client';

import { motion } from 'framer-motion';
import { UpscaleParams } from '@/types';

interface ParameterPanelProps {
  params: UpscaleParams;
  onChange: (params: UpscaleParams) => void;
  disabled?: boolean;
}

export default function ParameterPanel({ params, onChange, disabled }: ParameterPanelProps) {
  const scaleOptions = [
    { value: 2, label: '2×' },
    { value: 3, label: '3×' },
    { value: 4, label: '4×' },
  ];

  return (
    <div className="space-y-6">
      {/* Scale Factor */}
      <div>
        <label className="block text-sm text-stone-400 mb-3">
          Scale Factor
        </label>
        <div className="flex gap-2">
          {scaleOptions.map(({ value, label }) => (
            <motion.button
              key={value}
              whileHover={!disabled ? { scale: 1.02 } : {}}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              onClick={() => onChange({ ...params, scale: value })}
              disabled={disabled}
              className={`
                flex-1 py-3 px-4 rounded-lg font-mono text-sm
                border transition-all duration-200
                ${params.scale === value
                  ? 'bg-stone-800 border-stone-600 text-stone-200'
                  : 'bg-stone-900/50 border-stone-800 text-stone-500 hover:border-stone-700 hover:text-stone-400'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Denoise Strength */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm text-stone-400">
            Enhancement
          </label>
          <span className="text-xs font-mono text-stone-600">
            {Math.round(params.denoise * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={params.denoise * 100}
          onChange={(e) => onChange({ ...params, denoise: parseInt(e.target.value) / 100 })}
          disabled={disabled}
          className={`
            w-full h-2 rounded-full appearance-none cursor-pointer
            bg-stone-800 
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-stone-400
            [&::-webkit-slider-thumb]:hover:bg-stone-300
            [&::-webkit-slider-thumb]:transition-colors
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        <div className="flex justify-between mt-2">
          <span className="text-xs text-stone-700">Subtle</span>
          <span className="text-xs text-stone-700">Strong</span>
        </div>
      </div>

      {/* ML Toggle */}
      <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-stone-900/30 border border-stone-800/50">
        <div>
          <p className="text-sm text-stone-400">AI Enhancement</p>
          <p className="text-xs text-stone-600">Uses ML model when available</p>
        </div>
        <button
          onClick={() => onChange({ ...params, useMl: !params.useMl })}
          disabled={disabled}
          className={`
            relative w-12 h-7 rounded-full transition-colors duration-200
            ${params.useMl ? 'bg-stone-600' : 'bg-stone-800'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <motion.div
            layout
            className="absolute top-1 w-5 h-5 rounded-full bg-stone-300"
            animate={{ left: params.useMl ? '26px' : '4px' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>
    </div>
  );
}

