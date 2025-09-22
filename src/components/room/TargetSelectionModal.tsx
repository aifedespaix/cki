"use client";

import { CheckCircle2Icon, ShuffleIcon, TargetIcon } from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ImageSafe } from "@/components/common/ImageSafe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Card as GameCard } from "@/lib/game/types";
import { cn } from "@/lib/utils";

type TargetSelectionModalProps = {
  readonly cards: readonly GameCard[];
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly currentCardId: string | null;
  readonly playerName: string;
  readonly onConfirm: (cardId: string) => void;
};

function getRandomCard(cards: readonly GameCard[]): GameCard | null {
  if (cards.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * cards.length);
  return cards[index] ?? null;
}

type SelectableCardProps = {
  readonly card: GameCard;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
};

function SelectableCard({ card, isSelected, onSelect }: SelectableCardProps) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
      }
    },
    [onSelect],
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-pressed={isSelected}
      className={cn(
        "flex h-full flex-col gap-3 rounded-xl border bg-background/95 p-3 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected
          ? "border-primary/70 ring-2 ring-primary/60 ring-offset-2"
          : "border-border/60 hover:border-border",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
        {card.imageUrl ? (
          <ImageSafe
            src={card.imageUrl}
            alt={card.label}
            className="absolute inset-0"
            imageProps={{
              sizes: "(min-width: 1024px) 240px, (min-width: 768px) 45vw, 80vw",
            }}
            fallback={
              <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground">
                Image indisponible
              </span>
            }
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground">
            Aucun visuel
          </span>
        )}
        {isSelected ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow">
            <CheckCircle2Icon aria-hidden className="size-3.5" />
            Sélectionnée
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{card.label}</p>
        {card.description ? (
          <p className="text-xs text-muted-foreground line-clamp-3">
            {card.description}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function TargetSelectionModal({
  cards,
  isOpen,
  onOpenChange,
  currentCardId,
  playerName,
  onConfirm,
}: TargetSelectionModalProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    currentCardId,
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setSelectedCardId(currentCardId);
    setLocalError(null);
  }, [isOpen, currentCardId]);

  const selectedCard = useMemo(() => {
    if (!selectedCardId) {
      return null;
    }
    return cards.find((card) => card.id === selectedCardId) ?? null;
  }, [cards, selectedCardId]);

  const handleSelectCard = useCallback((cardId: string) => {
    setSelectedCardId(cardId);
    setLocalError(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!selectedCardId) {
      setLocalError("Sélectionnez une carte avant de confirmer.");
      return;
    }
    onConfirm(selectedCardId);
  }, [onConfirm, selectedCardId]);

  const handleRandomSelection = useCallback(() => {
    const randomCard = getRandomCard(cards);
    if (!randomCard) {
      setLocalError(
        "Aucune carte n’est disponible pour la sélection aléatoire.",
      );
      return;
    }
    setSelectedCardId(randomCard.id);
    setLocalError(null);
  }, [cards]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-2 border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <TargetIcon aria-hidden className="size-5 text-primary" />
            Choisissez la carte secrète de {playerName}
          </DialogTitle>
          <DialogDescription>
            Parcourez les cartes disponibles, effectuez une sélection manuelle
            ou laissez le système choisir aléatoirement. Confirmez pour
            verrouiller la carte secrète.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 pt-6">
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <span>
                {selectedCard
                  ? `${selectedCard.label} est prête à être confirmée.`
                  : "Aucune carte sélectionnée pour le moment."}
              </span>
              <span>
                Choisissez une carte ou utilisez la sélection aléatoire pour
                gagner du temps.
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRandomSelection}
              disabled={cards.length === 0}
            >
              <ShuffleIcon aria-hidden className="mr-2 size-4" />
              Sélection aléatoire
            </Button>
          </div>
          <ScrollArea className="px-6">
            <div className="pb-6">
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {cards.map((card) => (
                  <li key={card.id} className="list-none">
                    <SelectableCard
                      card={card}
                      isSelected={selectedCardId === card.id}
                      onSelect={() => handleSelectCard(card.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </ScrollArea>
        </div>
        <DialogFooter className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {localError ? (
              <p className="text-sm text-destructive">{localError}</p>
            ) : (
              <Badge variant="outline" className="text-xs uppercase">
                {selectedCard ? "Prêt à confirmer" : "Sélection requise"}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleConfirm}>
              Confirmer la carte secrète
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { TargetSelectionModal };
