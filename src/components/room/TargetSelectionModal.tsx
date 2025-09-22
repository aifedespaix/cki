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
  readonly className?: string;
};

type CardSelectionSectionProps = {
  readonly cards: readonly GameCard[];
  readonly selectedCardId: string | null;
  readonly onSelectCard: (cardId: string) => void;
  readonly onRequestRandomCard: () => void;
  readonly hasCards: boolean;
  readonly selectedCard: GameCard | null;
  readonly className?: string;
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
function SelectedCardPreview({
  card,
  playerName,
  className,
}: SelectedCardPreviewProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-background p-5 shadow-sm",
        className,
      )}
    >
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
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[0.65rem] font-semibold uppercase text-foreground shadow">
              Aperçu
            </span>
          </CardArtwork>
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-foreground">{card.label}</p>
            {card.description ? (
              <p className="text-muted-foreground">{card.description}</p>
            ) : (
              <p className="text-muted-foreground">
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

/**
 * Provides the list of selectable cards together with contextual instructions
 * and quick actions, while constraining the overall height to keep the modal
 * fully scrollable.
 */
function CardSelectionSection({
  cards,
  selectedCardId,
  onSelectCard,
  onRequestRandomCard,
  hasCards,
  selectedCard,
  className,
}: CardSelectionSectionProps) {
  const cardCount = cards.length;

  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-background shadow-sm",
        className,
      )}
    >
      <header className="space-y-3 border-b px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Parcourir les cartes
            </h3>
            <p className="text-sm text-muted-foreground">
              {selectedCard
                ? `${selectedCard.label} est prête à être confirmée.`
                : hasCards
                  ? "Choisissez une carte ou utilisez la sélection aléatoire."
                  : "Ajoutez des cartes à la grille pour effectuer une sélection."}
            </p>
          </div>
          <Badge
            className="self-start text-[0.65rem] font-semibold uppercase tracking-wide"
            variant="outline"
          >
            {cardCount === 1
              ? "1 carte disponible"
              : `${cardCount} cartes disponibles`}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRequestRandomCard}
            disabled={!hasCards}
          >
            <ShuffleIcon aria-hidden className="mr-2 size-4" />
            Sélection aléatoire
          </Button>
        </div>
      </header>
      {hasCards ? (
        <ScrollArea
          className="max-h-[45vh] sm:max-h-[52vh] lg:max-h-[60vh]"
          aria-label="Cartes disponibles"
        >
          <div className="px-5 pb-5 sm:px-6">
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <li key={card.id} className="list-none">
                  <SelectableCard
                    card={card}
                    isSelected={selectedCardId === card.id}
                    onSelect={() => onSelectCard(card.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
          Aucune carte n’est disponible pour le moment.
        </div>
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
  const hasCards = cards.length > 0;

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
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden p-0 sm:max-w-5xl">
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
        <div className="flex flex-1 flex-col gap-6 overflow-hidden px-6 pb-6 pt-4 sm:pt-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr] lg:items-start">
            <CardSelectionSection
              cards={cards}
              selectedCardId={selectedCardId}
              onSelectCard={handleSelectCard}
              onRequestRandomCard={handleRandomSelection}
              hasCards={hasCards}
              selectedCard={selectedCard}
              className="order-1 lg:order-2"
            />
            <SelectedCardPreview
              card={selectedCard}
              playerName={playerName}
              className="order-2 lg:order-1"
            />
          </div>
        </div>
        <DialogFooter className="flex flex-col gap-4 border-t bg-background/95 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {localError ? (
              <p className="text-sm text-destructive" role="alert">
                {localError}
              </p>
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
