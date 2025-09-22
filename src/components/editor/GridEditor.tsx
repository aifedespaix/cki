"use client";

import { RefreshCcwIcon } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Card as GameCard, Grid } from "@/lib/game/types";
import {
  type ImageAssetDraft,
  loadGridDraft,
  saveGridDraft,
} from "@/lib/storage/db";
import { createRandomId } from "@/lib/utils";

import { CardEditorItem } from "./CardEditorItem";
import { GridPreview } from "./GridPreview";

const MIN_DIMENSION = 2;
const MAX_DIMENSION = 8;

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
export interface GridEditorHandle {
  /**
   * Returns the current grid with all inputs normalised (labels trimmed,
   * fallback identifiers applied). The internal component state is updated to
   * reflect the normalised values so subsequent renders stay in sync.
   */
  commitGrid(): Grid;
  /** Latest processed metadata for cards backed by locally stored images. */
  getAssets(): Record<string, ImageAssetDraft>;
}

export interface GridEditorProps {
  /** Optional callback triggered whenever the grid preview object changes. */
  onGridChange?: (grid: Grid) => void;
}

export const GridEditor = forwardRef<GridEditorHandle, GridEditorProps>(
  ({ onGridChange }, ref) => {
    const [gridId, setGridId] = useState(() => createRandomId("grid"));
    const [gridName, setGridName] = useState("Grille personnalisée");
    const [rows, setRows] = useState(4);
    const [columns, setColumns] = useState(4);
    const [cards, setCards] = useState<GameCard[]>(() => {
      const total = 4 * 4;
      return Array.from({ length: total }, (_, index) => createCard(index));
    });
    const [imageMetadata, setImageMetadata] = useState<
      Record<string, ImageAssetDraft>
    >({});
    const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

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
          console.error(
            "Impossible de restaurer le brouillon précédent.",
            error,
          );
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
          shareState: null,
          lastSharedSignature: null,
          assets: filteredAssetMetadata,
        });
      }, 400);

      return () => {
        window.clearTimeout(timeout);
      };
    }, [previewGrid, filteredAssetMetadata, hasRestoredDraft]);

    useEffect(() => {
      if (typeof onGridChange === "function") {
        onGridChange(previewGrid);
      }
    }, [previewGrid, onGridChange]);

    const handleRowsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      setRows(clampDimension(event.target.valueAsNumber));
    };

    const handleColumnsChange = (
      event: React.ChangeEvent<HTMLInputElement>,
    ) => {
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

    const buildNormalisedGrid = useCallback((): Grid => {
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

      return {
        id: normaliseLabel(gridId, createRandomId("grid")),
        name: normaliseLabel(gridName, "Grille personnalisée"),
        rows,
        columns,
        cards: trimmedCards,
      } satisfies Grid;
    }, [cards, columns, gridId, gridName, rows]);

    useImperativeHandle(
      ref,
      () => ({
        commitGrid() {
          const normalised = buildNormalisedGrid();
          setGridId(normalised.id);
          setGridName(normalised.name);
          setCards(normalised.cards);
          return normalised;
        },
        getAssets() {
          return filteredAssetMetadata;
        },
      }),
      [buildNormalisedGrid, filteredAssetMetadata],
    );

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
                Définissez le nom et l’illustration de chaque carte. Les images
                en data URI augmentent la taille du lien : privilégiez les URLs
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
        </div>
      </div>
    );
  },
);

GridEditor.displayName = "GridEditor";
