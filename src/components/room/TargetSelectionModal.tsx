"use client";

import { CheckCircle2Icon, ShuffleIcon, TargetIcon } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
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

type CardArtworkProps = {
  readonly card: GameCard;
  readonly containerClassName?: string;
  readonly imageSizes?: string;
  readonly fallbackText?: string;
  readonly children?: ReactNode;
};

type SelectedCardPreviewProps = {
  readonly card: GameCard | null;
  readonly playerName: string;
};

/**
 * Displays the artwork associated with a card while ensuring a consistent
 * aspect ratio and providing a textual fallback when the image is missing.
 */
function CardArtwork({
  card,
  containerClassName,
  imageSizes = "(min-width: 1024px) 240px, (min-width: 768px) 45vw, 80vw",
  fallbackText = "Image indisponible",
  children,
}: CardArtworkProps) {
  const placeholderText = card.imageUrl ? fallbackText : "Aucun visuel";

  return (
    <div
      className={cn(
        "relative aspect-[4/3] overflow-hidden rounded-lg bg-muted",
        containerClassName,
      )}
    >
      {card.imageUrl ? (
        <ImageSafe
          src={card.imageUrl}
          alt={card.label}
          className="absolute inset-0"
          imageProps={{
            sizes: imageSizes,
          }}
          fallback={
            <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground">
              {placeholderText}
            </span>
          }
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs text-muted-foreground">
          {placeholderText}
        </span>
      )}
      {children}
    </div>
  );
}

/**
 * Summarises the currently selected card so that players keep the context even
 * when the card grid is scrolled away.
 */
function SelectedCardPreview({ card, playerName }: SelectedCardPreviewProps) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Aperçu pour {playerName}
        </h3>
        <Badge
          variant={card ? "secondary" : "outline"}
          className="text-[0.65rem] font-medium uppercase tracking-wide"
        >
          {card ? "Sélection en cours" : "En attente"}
        </Badge>
      </div>
      {card ? (
        <>
          <CardArtwork card={card}>
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[0.65rem] font-semibold uppercase text-foreground shadow">
              Aperçu
            </span>
          </CardArtwork>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{card.label}</p>
            {card.description ? (
              <p className="text-sm text-muted-foreground">
                {card.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Cette carte ne possède pas de description supplémentaire.
              </p>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sélectionnez une carte dans la liste pour visualiser les détails ici.
        </p>
      )}
    </section>
  );
}

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

/**
 * Renders a selectable card thumbnail with keyboard support and selected
 * states suitable for the target selection grid.
 */
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
      aria-label={`Sélectionner ${card.label}`}
      className={cn(
        "flex h-full flex-col gap-3 rounded-xl border bg-background/95 p-3 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected
          ? "border-primary/70 ring-2 ring-primary/60 ring-offset-2"
          : "border-border/60 hover:border-border",
      )}
    >
      <CardArtwork card={card}>
        {isSelected ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground shadow">
            <CheckCircle2Icon aria-hidden className="size-3.5" />
            Sélectionnée
          </span>
        ) : null}
      </CardArtwork>
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

/**
 * Modal allowing a player to choose a secret target card with responsive
 * layout, contextual preview, and safeguards against invalid selections.
 */
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
  const cardCount = cards.length;
  const hasCards = cardCount > 0;

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
    setLocalError(null);
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
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
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
        <div className="flex flex-1 flex-col gap-6 overflow-hidden px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <section className="flex flex-col gap-4 rounded-xl border bg-background p-4 shadow-sm">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {selectedCard
                    ? `${selectedCard.label} est prête à être confirmée.`
                    : "Aucune carte sélectionnée pour le moment."}
                </p>
                <p>
                  {hasCards
                    ? "Choisissez une carte ou laissez le système décider pour vous."
                    : "Ajoutez des cartes à la grille pour pouvoir effectuer une sélection."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[0.65rem] uppercase">
                  {cardCount === 1
                    ? "1 carte disponible"
                    : `${cardCount} cartes disponibles`}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={handleRandomSelection}
                  disabled={!hasCards}
                >
                  <ShuffleIcon aria-hidden className="mr-2 size-4" />
                  Sélection aléatoire
                </Button>
              </div>
            </section>
            <SelectedCardPreview card={selectedCard} playerName={playerName} />
          </div>
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="pe-4 pb-6">
              {hasCards ? (
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
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                  Aucune carte n’est disponible pour le moment.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter className="flex flex-col gap-4 border-t bg-background/95 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
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
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedCardId}
            >
              Confirmer la carte secrète
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { TargetSelectionModal };
