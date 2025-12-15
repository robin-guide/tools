export interface UpscaleParams {
  scale: number;
  denoise: number;
  creativity: number;
  useMl: boolean;
}

export interface UpscaleResponse {
  success: boolean;
  image_base64?: string;
  original_size?: [number, number];
  upscaled_size?: [number, number];
  method?: string;
  error?: string;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model_loading: boolean;
  model_type?: string; // "seedvr2_3b", "seedvr2_7b", "sd_upscaler", "ldsr"
  gpu_available: boolean;
  device: string;
  error?: string;
}

export type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

export interface ImageData {
  file: File;
  preview: string;
  name: string;
  size: number;
  dimensions?: { width: number; height: number };
}

