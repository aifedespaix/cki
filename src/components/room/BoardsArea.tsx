"use client";

import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type Size = {
  width: number;
  height: number;
};

export type BoardsLayout = "horizontal" | "vertical";

type BoardsAreaBoard = {
  readonly key: string;
  readonly content: ReactNode;
};

type BoardsAreaProps = {
  readonly boards: readonly BoardsAreaBoard[];
  readonly onLayoutChange?: (layout: BoardsLayout) => void;
  readonly className?: string;
};

const GAP_HORIZONTAL = 24;
const GAP_VERTICAL = 20;

function clampScale(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  if (value <= 0) {
    return 0.0001;
  }
  return Math.min(value, 1);
}

function createEmptySizes(count: number): Size[] {
  return Array.from({ length: count }, () => ({ width: 0, height: 0 }));
}

export function BoardsArea({
  boards,
  onLayoutChange,
  className,
}: BoardsAreaProps) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const boardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const previousLayoutRef = useRef<BoardsLayout>("horizontal");

  const [areaSize, setAreaSize] = useState<Size>({ width: 0, height: 0 });
  const [boardSizes, setBoardSizes] = useState<Size[]>(() =>
    createEmptySizes(boards.length),
  );

  const measureBoards = useCallback(() => {
    if (boardRefs.current.length === 0) {
      return createEmptySizes(boards.length);
    }
    return boardRefs.current.map((node) => {
      if (!node) {
        return { width: 0, height: 0 } satisfies Size;
      }
      return {
        width: node.offsetWidth,
        height: node.offsetHeight,
      } satisfies Size;
    });
  }, [boards.length]);

  const handleBoardRef = useCallback(
    (index: number, node: HTMLDivElement | null) => {
      boardRefs.current[index] = node;
      setBoardSizes(measureBoards());
    },
    [measureBoards],
  );

  useEffect(() => {
    boardRefs.current = boardRefs.current.slice(0, boards.length);
    setBoardSizes((sizes) => {
      if (sizes.length === boards.length) {
        return sizes;
      }
      return measureBoards();
    });
  }, [boards.length, measureBoards]);

  useEffect(() => {
    const node = areaRef.current;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setAreaSize((previous) => {
          if (previous.width === width && previous.height === height) {
            return previous;
          }
          return { width, height } satisfies Size;
        });
      }
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (boardRefs.current.length === 0) {
      setBoardSizes(createEmptySizes(boards.length));
      return;
    }

    const observers = boardRefs.current.map((node) => {
      if (!node) {
        return null;
      }
      const observer = new ResizeObserver(() => {
        setBoardSizes(measureBoards());
      });
      observer.observe(node);
      return observer;
    });

    setBoardSizes(measureBoards());

    return () => {
      for (const observer of observers) {
        observer?.disconnect();
      }
    };
  }, [boards.length, measureBoards]);

  const layout = useMemo(() => {
    const boardCount = boards.length;
    if (
      boardCount === 0 ||
      areaSize.width <= 0 ||
      areaSize.height <= 0 ||
      boardSizes.length === 0
    ) {
      return {
        orientation: "horizontal" as BoardsLayout,
        scale: 1,
        gap: GAP_HORIZONTAL,
      };
    }

    const maxWidth = Math.max(...boardSizes.map((size) => size.width));
    const maxHeight = Math.max(...boardSizes.map((size) => size.height));

    if (maxWidth === 0 || maxHeight === 0) {
      return {
        orientation: "horizontal" as BoardsLayout,
        scale: 1,
        gap: GAP_HORIZONTAL,
      };
    }

    const compute = (orientation: BoardsLayout) => {
      const gap = orientation === "horizontal" ? GAP_HORIZONTAL : GAP_VERTICAL;
      if (orientation === "horizontal") {
        const availableWidth = Math.max(
          areaSize.width - (boardCount - 1) * gap,
          0,
        );
        const widthScale = availableWidth / Math.max(maxWidth * boardCount, 1);
        const heightScale = areaSize.height / Math.max(maxHeight, 1);
        const scale = clampScale(Math.min(widthScale, heightScale));
        return { scale, gap };
      }
      const availableHeight = Math.max(
        areaSize.height - (boardCount - 1) * gap,
        0,
      );
      const heightScale = availableHeight / Math.max(maxHeight * boardCount, 1);
      const widthScale = areaSize.width / Math.max(maxWidth, 1);
      const scale = clampScale(Math.min(heightScale, widthScale));
      return { scale, gap };
    };

    const horizontal = compute("horizontal");
    const vertical = compute("vertical");

    if (horizontal.scale >= vertical.scale) {
      return {
        orientation: "horizontal" as BoardsLayout,
        scale: horizontal.scale,
        gap: horizontal.gap,
      };
    }

    return {
      orientation: "vertical" as BoardsLayout,
      scale: vertical.scale,
      gap: vertical.gap,
    };
  }, [areaSize.height, areaSize.width, boardSizes, boards.length]);

  useEffect(() => {
    if (!onLayoutChange) {
      return;
    }
    if (previousLayoutRef.current === layout.orientation) {
      return;
    }
    previousLayoutRef.current = layout.orientation;
    onLayoutChange(layout.orientation);
  }, [layout.orientation, onLayoutChange]);

  const isReady = useMemo(
    () =>
      areaSize.width > 0 &&
      areaSize.height > 0 &&
      boardSizes.length === boards.length &&
      boardSizes.every((size) => size.width > 0 && size.height > 0),
    [areaSize.height, areaSize.width, boardSizes, boards.length],
  );

  return (
    <div
      ref={areaRef}
      aria-busy={!isReady}
      data-orientation={layout.orientation}
      className={cn(
        "boards-area relative flex size-full items-center justify-center overflow-hidden",
        layout.orientation === "horizontal" ? "flex-row" : "flex-col",
        className,
      )}
      style={{ gap: `${layout.gap}px` }}
    >
      {boards.map((board, index) => {
        const size = boardSizes[index] ?? { width: 0, height: 0 };
        const scaledWidth = size.width * layout.scale;
        const scaledHeight = size.height * layout.scale;
        const slotStyle: CSSProperties = {
          width: scaledWidth,
          height: scaledHeight,
        };
        const isBoardReady = size.width > 0 && size.height > 0;

        return (
          <div
            key={board.key}
            className={cn(
              "boards-area__slot flex flex-shrink-0 items-start justify-center transition-opacity duration-200",
              isReady && isBoardReady ? "opacity-100" : "opacity-0",
            )}
            style={slotStyle}
          >
            <div
              className="boards-area__scale"
              style={{
                transform: `scale(${layout.scale})`,
                transformOrigin: "top left",
                contain: "layout paint size",
                willChange: "transform",
              }}
            >
              <div
                ref={(node) => handleBoardRef(index, node)}
                className="boards-area__content inline-flex"
              >
                {board.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
