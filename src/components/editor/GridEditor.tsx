"use client";

import {
  AlertCircleIcon,
  CopyIcon,
  RefreshCcwIcon,
  Share2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import type { Card as GameCard, Grid } from "@/lib/game/types";
import { buildInviteUrl, encodeGridToToken } from "@/lib/share/url";
import {
  type ImageAssetDraft,
  loadGridDraft,
  type StoredShareState,
  saveGridDraft,
} from "@/lib/storage/db";

import { CardEditorItem } from "./CardEditorItem";
import { GridPreview } from "./GridPreview";

const MIN_DIMENSION = 2;
const MAX_DIMENSION = 8;

const createRandomId = (prefix: string): string => {
  const randomSegment =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${randomSegment}`;
};

const createCard = (index: number): GameCard => ({
  id: createRandomId("card"),
  label: `Personnage ${index + 1}`,
});

const clampDimension = (value: number): number => {
  if (Number.isNaN(value)) {
    return MIN_DIMENSION;
  }
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, value));
};

const normaliseLabel = (label: string, fallback: string): string => {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const extractMimeTypeFromDataUrl = (dataUrl: string): string => {
  const match = /^data:([^;]+);/i.exec(dataUrl);
  return match?.[1] ?? "image/png";
};

const computeDataUrlBytes = (dataUrl: string): number => {
  const [, base64 = ""] = dataUrl.split(",");
  if (!base64) {
    return 0;
  }
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, (base64.length * 3) / 4 - padding);
};

/**
 * Main grid editor allowing the host to configure board dimensions and cards,
 * preview the layout and generate a shareable invitation link.
 */
export function GridEditor() {
  const [gridId, setGridId] = useState(() => createRandomId("grid"));
  const [gridName, setGridName] = useState("Grille personnalisée");
  const [rows, setRows] = useState(4);
  const [columns, setColumns] = useState(4);
  const [cards, setCards] = useState<GameCard[]>(() => {
    const total = 4 * 4;
    return Array.from({ length: total }, (_, index) => createCard(index));
  });
  const [shareState, setShareState] = useState<StoredShareState | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSharedSignature, setLastSharedSignature] = useState<string | null>(
    null,
  );
  const [imageMetadata, setImageMetadata] = useState<
    Record<string, ImageAssetDraft>
  >({});
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    const total = rows * columns;
    setCards((previous) => {
      if (previous.length === total) {
        return previous;
      }

      if (total > previous.length) {
        const nextCards = [...previous];
        for (let index = previous.length; index < total; index += 1) {
          nextCards.push(createCard(index));
        }
        return nextCards;
      }

      return previous.slice(0, total);
    });
  }, [rows, columns]);

  const previewGrid: Grid = useMemo(
    () => ({
      id: gridId,
      name: gridName,
      rows,
      columns,
      cards,
    }),
    [gridId, gridName, rows, columns, cards],
  );

  const signature = useMemo(() => JSON.stringify(previewGrid), [previewGrid]);

  const hasUnsavedChanges =
    shareState !== null && lastSharedSignature !== signature;

  useEffect(() => {
    setImageMetadata((previous) => {
      const activeIds = new Set(cards.map((card) => card.id));
      let mutated = false;
      const next: Record<string, ImageAssetDraft> = {};
      for (const [cardId, metadata] of Object.entries(previous)) {
        if (activeIds.has(cardId)) {
          next[cardId] = metadata;
        } else {
          mutated = true;
        }
      }
      return mutated ? next : previous;
    });
  }, [cards]);

  useEffect(() => {
    let cancelled = false;

    const restoreDraft = async () => {
      const draft = await loadGridDraft();
      if (!draft || cancelled) {
        return;
      }

      setGridId(draft.grid.id);
      setGridName(draft.grid.name);
      setRows(draft.grid.rows);
      setColumns(draft.grid.columns);
      setCards(draft.grid.cards);
      setShareState(draft.shareState);
      setLastSharedSignature(draft.lastSharedSignature);

      const restoredAssets: Record<string, ImageAssetDraft> = {};
      const now = Date.now();
      for (const card of draft.grid.cards) {
        if (!card.imageUrl || !card.imageUrl.startsWith("data:")) {
          continue;
        }
        const existing = draft.assets[card.id];
        if (existing) {
          restoredAssets[card.id] = existing;
        } else {
          const bytes = computeDataUrlBytes(card.imageUrl);
          restoredAssets[card.id] = {
            cardId: card.id,
            source: "upload",
            mimeType: extractMimeTypeFromDataUrl(card.imageUrl),
            processedBytes: bytes,
            originalBytes: bytes,
            createdAt: now,
          };
        }
      }
      if (!cancelled) {
        setImageMetadata(restoredAssets);
      }
    };

    restoreDraft()
      .catch((error) => {
        console.error("Impossible de restaurer le brouillon précédent.", error);
      })
      .finally(() => {
        if (!cancelled) {
          setHasRestoredDraft(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredAssetMetadata = useMemo(() => {
    const entries: Record<string, ImageAssetDraft> = {};
    for (const card of cards) {
      if (!card.imageUrl || !card.imageUrl.startsWith("data:")) {
        continue;
      }
      const metadata = imageMetadata[card.id];
      if (metadata) {
        entries[card.id] = metadata;
      }
    }
    return entries;
  }, [cards, imageMetadata]);

  useEffect(() => {
    if (!hasRestoredDraft) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void saveGridDraft({
        grid: previewGrid,
        shareState,
        lastSharedSignature,
        assets: filteredAssetMetadata,
      });
    }, 400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    previewGrid,
    shareState,
    lastSharedSignature,
    filteredAssetMetadata,
    hasRestoredDraft,
  ]);

  const handleRowsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRows(clampDimension(event.target.valueAsNumber));
  };

  const handleColumnsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setColumns(clampDimension(event.target.valueAsNumber));
  };

  const handleCardChange = (index: number, nextCard: GameCard) => {
    setCards((previous) => {
      const next = [...previous];
      next[index] = nextCard;
      return next;
    });
  };

  const handleImageProcessed = (metadata: ImageAssetDraft) => {
    setImageMetadata((previous) => {
      const current = previous[metadata.cardId];
      if (
        current &&
        current.mimeType === metadata.mimeType &&
        current.processedBytes === metadata.processedBytes &&
        current.originalBytes === metadata.originalBytes &&
        current.width === metadata.width &&
        current.height === metadata.height &&
        current.originalFileName === metadata.originalFileName &&
        current.originalUrl === metadata.originalUrl &&
        current.source === metadata.source
      ) {
        return previous;
      }
      return {
        ...previous,
        [metadata.cardId]: metadata,
      };
    });
  };

  const handleImageCleared = (cardId: string) => {
    setImageMetadata((previous) => {
      if (!(cardId in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[cardId];
      return next;
    });
  };

  const regenerateGridId = () => {
    setGridId(createRandomId("grid"));
  };

  const handleGenerateLink = () => {
    setIsGenerating(true);
    setShareError(null);

    try {
      const total = rows * columns;
      if (cards.length !== total) {
        throw new Error(
          "Le nombre de cartes doit correspondre exactement à la taille de la grille.",
        );
      }

      const trimmedCards: GameCard[] = cards.map((card, index) => ({
        ...card,
        label: normaliseLabel(card.label, `Personnage ${index + 1}`),
        description: card.description?.trim() || undefined,
      }));

      const trimmedGrid: Grid = {
        id: normaliseLabel(gridId, createRandomId("grid")),
        name: normaliseLabel(gridName, "Grille personnalisée"),
        rows,
        columns,
        cards: trimmedCards,
      };

      setGridId(trimmedGrid.id);
      setGridName(trimmedGrid.name);
      setCards(trimmedCards);

      const token = encodeGridToToken(trimmedGrid);
      const origin = window.location.origin;
      const url = buildInviteUrl(origin, token);

      setShareState({ token, url });
      setLastSharedSignature(JSON.stringify(trimmedGrid));
      toast({
        title: "Lien de partie généré",
        description:
          "Partagez ce lien avec votre invité pour charger la grille.",
      });
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : "Une erreur inattendue est survenue lors de la génération du lien.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareState?.url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareState.url);
      toast({
        title: "Lien copié",
        description:
          "L’URL d’invitation est disponible dans votre presse-papier.",
      });
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : "Impossible de copier le lien automatiquement.",
      );
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-8">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Paramètres de la grille</CardTitle>
            <CardDescription>
              Ajustez les dimensions et l’identifiant avant de configurer les
              cartes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="grid-name"
                  className="text-sm font-medium text-foreground"
                >
                  Nom de la grille
                </label>
                <input
                  id="grid-name"
                  type="text"
                  value={gridName}
                  onChange={(event) => setGridName(event.target.value)}
                  className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Tournoi d’entraînement"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="grid-id"
                    className="text-sm font-medium text-foreground"
                  >
                    Identifiant technique
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={regenerateGridId}
                    className="h-8 px-2 text-xs"
                  >
                    <RefreshCcwIcon
                      aria-hidden="true"
                      className="mr-1 size-3.5"
                    />
                    Régénérer
                  </Button>
                </div>
                <input
                  id="grid-id"
                  type="text"
                  value={gridId}
                  onChange={(event) => setGridId(event.target.value)}
                  className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="grid-tournoi"
                />
                <p className="text-xs text-muted-foreground">
                  Cet identifiant est inclus dans le lien partagé et permet de
                  reconnaître la grille.
                </p>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="grid-rows"
                  className="text-sm font-medium text-foreground"
                >
                  Nombre de lignes
                </label>
                <input
                  id="grid-rows"
                  type="number"
                  min={MIN_DIMENSION}
                  max={MAX_DIMENSION}
                  value={rows}
                  onChange={handleRowsChange}
                  className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="grid-columns"
                  className="text-sm font-medium text-foreground"
                >
                  Nombre de colonnes
                </label>
                <input
                  id="grid-columns"
                  type="number"
                  min={MIN_DIMENSION}
                  max={MAX_DIMENSION}
                  value={columns}
                  onChange={handleColumnsChange}
                  className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              La grille contiendra {rows * columns} cartes. Ajustez ensuite
              chaque carte pour personnaliser les avatars.
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Cartes du plateau</CardTitle>
            <CardDescription>
              Définissez le nom et l’illustration de chaque carte. Les images en
              data URI augmentent la taille du lien : privilégiez les URLs
              publiques lorsque c’est possible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {cards.map((card, index) => (
                <CardEditorItem
                  key={card.id}
                  card={card}
                  index={index}
                  assetMetadata={imageMetadata[card.id]}
                  onChange={(nextCard) => handleCardChange(index, nextCard)}
                  onImageProcessed={handleImageProcessed}
                  onImageCleared={handleImageCleared}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Aperçu</CardTitle>
            <CardDescription>
              Vérifiez le rendu final tel qu’il sera affiché aux joueurs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GridPreview grid={previewGrid} />
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Lien d’invitation</CardTitle>
            <CardDescription>
              Générez un lien compressé contenant la configuration de la grille.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              size="lg"
              onClick={handleGenerateLink}
              disabled={isGenerating}
              className="w-full"
            >
              <Share2Icon aria-hidden="true" className="mr-2 size-4" />
              {isGenerating
                ? "Génération en cours…"
                : "Créer le lien d’invitation"}
            </Button>
            {shareError ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4" />
                <span>{shareError}</span>
              </div>
            ) : null}
            {shareState ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
                  <span>URL générée</span>
                  {hasUnsavedChanges ? (
                    <span className="font-medium text-amber-600">
                      Modifications non partagées
                    </span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    readOnly
                    value={shareState.url}
                    className="flex-1 cursor-text rounded-md border border-border/70 bg-muted/50 px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCopyLink}
                    className="shrink-0"
                  >
                    <CopyIcon aria-hidden="true" className="mr-2 size-4" />
                    Copier
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Le destinataire doit ouvrir ce lien sur la page « Rejoindre ».
                  Le fragment (#token) contient la grille compressée.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Générez un lien pour partager instantanément la configuration
                avec votre invité.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
