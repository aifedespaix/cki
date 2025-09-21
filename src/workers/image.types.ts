export interface ImageProcessOptions {
  maxWidth: number;
  maxHeight: number;
  format: string;
  quality: number;
}

export interface ImageProcessRequest {
  id: string;
  type: "process-image";
  payload: {
    blob: Blob;
    options: ImageProcessOptions;
  };
}

export interface ProcessedImage {
  dataUrl: string;
  width: number;
  height: number;
  mimeType: string;
  byteLength: number;
}

export interface ImageProcessSuccess {
  id: string;
  success: true;
  result: ProcessedImage;
}

export interface ImageProcessFailure {
  id: string;
  success: false;
  error: string;
}

export type ImageWorkerResponse = ImageProcessSuccess | ImageProcessFailure;
