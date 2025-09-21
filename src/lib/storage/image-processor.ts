import type {
  ImageProcessOptions,
  ImageProcessRequest,
  ImageWorkerResponse,
  ProcessedImage,
} from "@/workers/image.types";

const DEFAULT_OPTIONS: ImageProcessOptions = {
  maxWidth: 512,
  maxHeight: 512,
  format: "image/webp",
  quality: 0.82,
};

type PendingRequest = {
  resolve: (value: ProcessedImage) => void;
  reject: (reason: Error) => void;
};

let worker: Worker | null = null;
const pendingRequests = new Map<string, PendingRequest>();

const createWorker = (): Worker => {
  if (typeof window === "undefined") {
    throw new Error("Le traitement d’image nécessite un contexte navigateur.");
  }

  const instance = new Worker(
    new URL("../../workers/image.ts", import.meta.url),
    { type: "module" },
  );

  instance.addEventListener(
    "message",
    (event: MessageEvent<ImageWorkerResponse>) => {
      const message = event.data;
      if (!message || !message.id) {
        return;
      }
      const pending = pendingRequests.get(message.id);
      if (!pending) {
        return;
      }
      pendingRequests.delete(message.id);
      if (message.success) {
        pending.resolve(message.result);
      } else {
        pending.reject(new Error(message.error));
      }
    },
  );

  instance.addEventListener("error", (event) => {
    console.error("Erreur non gérée dans le worker d’image.", event);
  });

  return instance;
};

const ensureWorker = (): Worker => {
  if (!worker) {
    worker = createWorker();
  }
  return worker;
};

const createRequestId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `img-${Math.random().toString(36).slice(2, 12)}`;
};

export interface ProcessImageOptions extends Partial<ImageProcessOptions> {}

export const processImage = async (
  blob: Blob,
  options: ProcessImageOptions = {},
): Promise<ProcessedImage> => {
  const workerInstance = ensureWorker();
  const requestId = createRequestId();

  const payloadOptions: ImageProcessOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const request: ImageProcessRequest = {
    id: requestId,
    type: "process-image",
    payload: {
      blob,
      options: payloadOptions,
    },
  };

  return new Promise<ProcessedImage>((resolve, reject) => {
    pendingRequests.set(requestId, {
      resolve,
      reject,
    });
    try {
      workerInstance.postMessage(request, [blob]);
    } catch (error) {
      pendingRequests.delete(requestId);
      reject(
        error instanceof Error
          ? error
          : new Error("Impossible d’envoyer l’image au worker."),
      );
    }
  });
};

export const disposeImageWorker = () => {
  if (worker) {
    worker.terminate();
    worker = null;
    pendingRequests.clear();
  }
};
