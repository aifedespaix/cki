/// <reference lib="webworker" />

import type {
  ImageProcessOptions,
  ImageProcessRequest,
  ImageWorkerResponse,
  ProcessedImage,
} from "./image.types";

declare const self: DedicatedWorkerGlobalScope;

const DEFAULT_FALLBACK_FORMAT = "image/png";

const toDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Le contenu image n’a pas pu être converti."));
      }
    };
    reader.onerror = () => {
      reject(new Error("La lecture du flux image a échoué."));
    };
    reader.readAsDataURL(blob);
  });

const computeTargetDimensions = (
  width: number,
  height: number,
  options: ImageProcessOptions,
) => {
  const widthRatio = options.maxWidth / width;
  const heightRatio = options.maxHeight / height;
  const scale = Math.min(widthRatio, heightRatio, 1);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  return { targetWidth, targetHeight };
};

const renderBitmap = async (
  bitmap: ImageBitmap,
  originalBlob: Blob,
  options: ImageProcessOptions,
): Promise<{ blob: Blob; width: number; height: number }> => {
  const { targetWidth, targetHeight } = computeTargetDimensions(
    bitmap.width,
    bitmap.height,
    options,
  );

  if (typeof OffscreenCanvas === "undefined") {
    return {
      blob: originalBlob,
      width: bitmap.width,
      height: bitmap.height,
    };
  }

  const canvas = new OffscreenCanvas(targetWidth, targetHeight);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Impossible d’initialiser le contexte de rendu.");
  }
  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

  try {
    const blob = await canvas.convertToBlob({
      type: options.format,
      quality: options.quality,
    });
    return { blob, width: targetWidth, height: targetHeight };
  } catch (error) {
    console.warn(
      "Échec de la conversion vers le format demandé, recours au PNG.",
      error,
    );
    const blob = await canvas.convertToBlob({
      type: DEFAULT_FALLBACK_FORMAT,
    });
    return { blob, width: targetWidth, height: targetHeight };
  }
};

const processBlob = async (
  blob: Blob,
  options: ImageProcessOptions,
): Promise<ProcessedImage> => {
  const bitmap = await createImageBitmap(blob);
  try {
    const {
      blob: processedBlob,
      width,
      height,
    } = await renderBitmap(bitmap, blob, options);
    const dataUrl = await toDataUrl(processedBlob);
    return {
      dataUrl,
      width,
      height,
      mimeType: processedBlob.type || options.format,
      byteLength: processedBlob.size,
    };
  } finally {
    bitmap.close();
  }
};

self.addEventListener(
  "message",
  async (event: MessageEvent<ImageProcessRequest>) => {
    const message = event.data;
    if (!message || message.type !== "process-image") {
      return;
    }

    try {
      const result = await processBlob(
        message.payload.blob,
        message.payload.options,
      );
      const response: ImageWorkerResponse = {
        id: message.id,
        success: true,
        result,
      };
      self.postMessage(response);
    } catch (error) {
      const response: ImageWorkerResponse = {
        id: message.id,
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Le traitement de l’image a échoué.",
      };
      self.postMessage(response);
    }
  },
);
