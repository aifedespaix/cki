"use client";

import { ImageIcon, PencilIcon, SparklesIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ImageSafe } from "@/components/common/ImageSafe";
import { Button } from "@/components/ui/button";
import type { Card, Grid } from "@/lib/game/types";

interface EditableGridPreviewProps {
  grid: Grid;
  onCardLabelChange: (cardId: string, nextLabel: string) => void;
  onRandomLabel: (cardId: string) => string;
  onRequestImageEdit: (cardId: string) => void;
}

interface EditingState {
  cardId: string;
  value: string;
}

export function EditableGridPreview({
  grid,
  onCardLabelChange,
  onRandomLabel,
  onRequestImageEdit,
}: EditableGridPreviewProps) {
  const templateColumns = useMemo(
    () => `repeat(${grid.columns}, minmax(0, 1fr))`,
    [grid.columns],
  );
  const [editing, setEditing] = useState<EditingState | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      return;
    }
    const isCardStillPresent = grid.cards.some(
      (card) => card.id === editing.cardId,
    );
    if (!isCardStillPresent) {
      setEditing(null);
    }
  }, [grid.cards, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleStartEditing = (card: Card) => {
    setEditing({ cardId: card.id, value: card.label });
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditing((current) =>
      current ? { ...current, value: event.target.value } : current,
    );
  };

  const handleCommit = () => {
    if (!editing) {
      return;
    }
    const currentCard = grid.cards.find((card) => card.id === editing.cardId);
    if (!currentCard) {
      setEditing(null);
      return;
    }
    if (currentCard.label !== editing.value) {
      onCardLabelChange(editing.cardId, editing.value);
    }
    setEditing(null);
  };

  const handleCancel = () => {
    setEditing(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCommit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  };

  const handleRandomLabel = (cardId: string) => {
    const nextLabel = onRandomLabel(cardId);
    setEditing((current) =>
      current && current.cardId === cardId
        ? { cardId, value: nextLabel }
        : current,
    );
  };

  if (grid.cards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        Ajoutez des cartes pour personnaliser votre plateau.
      </div>
    );
  }

  return (
    <ul
      className="grid gap-3"
      style={{ gridTemplateColumns: templateColumns }}
      aria-label={`Grille ${grid.rows} × ${grid.columns} modifiable`}
    >
      {grid.cards.map((card, index) => {
        const isEditing = editing?.cardId === card.id;
        const displayLabel = card.label || `Personnage ${index + 1}`;
        return (
          <li
            key={card.id}
            className="flex flex-col gap-3 rounded-md border border-border/60 bg-background/80 p-3 shadow-sm"
          >
            <button
              type="button"
              onClick={() => onRequestImageEdit(card.id)}
              className="relative flex aspect-square items-center justify-center overflow-hidden rounded-md border border-border/50 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Modifier l’image de ${displayLabel}`}
            >
              {card.imageUrl ? (
                <ImageSafe
                  src={card.imageUrl}
                  alt={displayLabel}
                  className="absolute inset-0"
                  imageProps={{
                    sizes:
                      "(min-width: 1024px) 200px, (min-width: 768px) 33vw, 50vw",
                  }}
                  fallback={
                    <span className="z-10 px-2 text-center text-xs text-destructive">
                      Impossible de charger l’image
                    </span>
                  }
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageIcon aria-hidden className="size-6" />
                  <span className="text-xs font-medium uppercase tracking-wide">
                    Ajouter une image
                  </span>
                </div>
              )}
              <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground shadow">
                Modifier
              </span>
            </button>
            <div className="flex flex-col gap-2">
              {isEditing ? (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      ref={inputRef}
                      value={editing.value}
                      onChange={handleInputChange}
                      onBlur={handleCommit}
                      onKeyDown={handleKeyDown}
                      className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder={`Personnage ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleRandomLabel(card.id)}
                    >
                      <SparklesIcon aria-hidden className="mr-2 size-4" />
                      Nom aléatoire
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Appuyez sur Entrée pour valider ou Échap pour annuler.
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStartEditing(card)}
                  className="group flex items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Modifier le nom de ${displayLabel}`}
                >
                  <span className="text-sm font-medium text-foreground">
                    {displayLabel}
                  </span>
                  <PencilIcon
                    aria-hidden
                    className="size-4 text-muted-foreground transition-colors group-hover:text-primary"
                  />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
