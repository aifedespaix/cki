"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Card, Grid } from "@/lib/game/types";

interface GridPreviewProps {
  grid: Grid;
}

type ImageLoadState = "idle" | "loading" | "loaded" | "error";

function CardPreview({ card }: { card: Card }) {
  const [status, setStatus] = useState<ImageLoadState>(
    card.imageUrl ? "loading" : "idle",
  );

  useEffect(() => {
    setStatus(card.imageUrl ? "loading" : "idle");
  }, [card.imageUrl]);

  return (
    <li className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/80 p-3 shadow-sm">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md bg-muted">
        {card.imageUrl ? (
          <>
            {status !== "loaded" && status !== "error" ? (
              <Skeleton className="absolute inset-0" />
            ) : null}
            <Image
              src={card.imageUrl}
              alt={card.label}
              fill
              unoptimized
              sizes="(min-width: 1024px) 200px, (min-width: 768px) 33vw, 50vw"
              onLoadingComplete={() => setStatus("loaded")}
              onError={() => setStatus("error")}
              className={`object-cover transition-opacity duration-200 ${
                status === "loaded" ? "opacity-100" : "opacity-0"
              }`}
            />
            {status === "error" ? (
              <span className="z-10 px-2 text-center text-xs text-destructive">
                Impossible de charger l’image
              </span>
            ) : null}
          </>
        ) : (
          <span className="px-2 text-center text-xs text-muted-foreground">
            Aucune illustration
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">
          {card.label}
        </span>
        {card.description ? (
          <p className="text-xs text-muted-foreground">{card.description}</p>
        ) : null}
      </div>
    </li>
  );
}

/** Visual preview rendering the grid layout exactly as the guests will see it. */
export function GridPreview({ grid }: GridPreviewProps) {
  const templateColumns = `repeat(${grid.columns}, minmax(0, 1fr))`;

  if (grid.cards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        Ajoutez des cartes pour afficher l’aperçu.
      </div>
    );
  }

  return (
    <ul
      className="grid gap-3"
      style={{ gridTemplateColumns: templateColumns }}
      aria-label={`Aperçu de la grille ${grid.rows} × ${grid.columns}`}
    >
      {grid.cards.map((card) => (
        <CardPreview key={card.id} card={card} />
      ))}
    </ul>
  );
}
