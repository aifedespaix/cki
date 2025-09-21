"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type ImageLoadStatus = "idle" | "loading" | "loaded" | "error";

const shouldRequestAnonymous = (src?: string): boolean => {
  if (!src) {
    return false;
  }
  if (src.startsWith("data:")) {
    return false;
  }
  if (src.startsWith("blob:")) {
    return false;
  }
  if (typeof window === "undefined") {
    return /^https?:/i.test(src);
  }
  try {
    const url = new URL(src, window.location.origin);
    return url.origin !== window.location.origin;
  } catch (_error) {
    return /^https?:/i.test(src);
  }
};

export interface ImageSafeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  src?: string;
  alt: string;
  imageClassName?: string;
  skeletonClassName?: string;
  fallback?: React.ReactNode;
  imageProps?: Omit<
    React.ImgHTMLAttributes<HTMLImageElement>,
    "src" | "alt" | "crossOrigin"
  >;
  crossOrigin?: "anonymous" | "use-credentials";
  onStatusChange?: (status: ImageLoadStatus) => void;
}

export const ImageSafe = React.forwardRef<HTMLImageElement, ImageSafeProps>(
  (
    {
      src,
      alt,
      className,
      imageClassName,
      skeletonClassName,
      fallback,
      imageProps,
      crossOrigin,
      onStatusChange,
      ...containerProps
    },
    forwardedRef,
  ) => {
    const [status, setStatus] = React.useState<ImageLoadStatus>(
      src ? "loading" : "idle",
    );

    const imageRef = React.useRef<HTMLImageElement | null>(null);

    React.useImperativeHandle(forwardedRef, () => imageRef.current);

    React.useEffect(() => {
      setStatus(src ? "loading" : "idle");
    }, [src]);

    React.useEffect(() => {
      if (onStatusChange) {
        onStatusChange(status);
      }
    }, [status, onStatusChange]);

    const resolvedCrossOrigin =
      crossOrigin ?? (shouldRequestAnonymous(src) ? "anonymous" : undefined);

    const {
      className: providedImageClassName,
      onLoad,
      onError,
      loading,
      decoding,
      ...remainingImageProps
    } = imageProps ?? {};

    return (
      <div
        {...containerProps}
        className={cn(
          "relative isolate h-full w-full overflow-hidden",
          className,
        )}
        aria-busy={status === "loading"}
      >
        {status === "loading" ? (
          <Skeleton
            aria-hidden="true"
            className={cn("absolute inset-0", skeletonClassName)}
          />
        ) : null}
        {src ? (
          /* biome-ignore lint/performance/noImgElement: We require direct <img> access to configure crossOrigin for canvas rendering safety. */
          <img
            {...remainingImageProps}
            ref={(node) => {
              imageRef.current = node;
              if (typeof forwardedRef === "function") {
                forwardedRef(node);
              } else if (forwardedRef) {
                forwardedRef.current = node;
              }
            }}
            src={src}
            alt={alt}
            className={cn(
              "h-full w-full object-cover transition-opacity duration-200",
              providedImageClassName,
              imageClassName,
              status === "loaded" ? "opacity-100" : "opacity-0",
            )}
            crossOrigin={resolvedCrossOrigin}
            loading={loading ?? "lazy"}
            decoding={decoding ?? "async"}
            onLoad={(event) => {
              setStatus("loaded");
              onLoad?.(event);
            }}
            onError={(event) => {
              setStatus("error");
              onError?.(event);
            }}
          />
        ) : null}
        {(!src || status === "error") && fallback ? (
          <div className="absolute inset-0 flex items-center justify-center">
            {fallback}
          </div>
        ) : null}
      </div>
    );
  },
);

ImageSafe.displayName = "ImageSafe";
