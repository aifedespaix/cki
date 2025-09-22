"use client";

import { RefreshCcwIcon, SparklesIcon } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createRandomSeed,
  generateRandomCards,
  generateRandomFirstName,
} from "@/lib/game/random-characters";
import type { Card as GameCard, Grid } from "@/lib/game/types";
import {
  type ImageAssetDraft,
  loadGridDraft,
  saveGridDraft,
} from "@/lib/storage/db";
import { createRandomId } from "@/lib/utils";

import { CardImageEditorDialog } from "./CardImageEditorDialog";
import { EditableGridPreview } from "./EditableGridPreview";

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
    const [activeImageCardId, setActiveImageCardId] = useState<string | null>(
      null,
    );

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
      if (!activeImageCardId) {
        return;
      }
      const stillExists = cards.some((card) => card.id === activeImageCardId);
      if (!stillExists) {
        setActiveImageCardId(null);
      }
    }, [activeImageCardId, cards]);

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

    const updateCard = useCallback(
      (cardId: string, updater: (card: GameCard) => GameCard) => {
        setCards((previous) => {
          const index = previous.findIndex((card) => card.id === cardId);
          if (index === -1) {
            return previous;
          }
          const next = [...previous];
          next[index] = updater(previous[index]);
          return next;
        });
      },
      [],
    );

    const handleCardUpdate = useCallback(
      (nextCard: GameCard) => {
        updateCard(nextCard.id, () => nextCard);
      },
      [updateCard],
    );

    const handleCardLabelChange = useCallback(
      (cardId: string, nextLabel: string) => {
        updateCard(cardId, (card) => ({ ...card, label: nextLabel }));
      },
      [updateCard],
    );

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

    const handleGenerateRandomGrid = useCallback(() => {
      const seed = createRandomSeed();
      setCards((previousCards) => {
        if (previousCards.length === 0) {
          return previousCards;
        }
        return generateRandomCards({
          cards: previousCards,
          seed,
        });
      });
      // Drop any processed image metadata because random avatars rely on
      // remote URLs rather than locally optimised assets.
      setImageMetadata(() => ({}));
    }, []);

    const handleRandomLabel = useCallback(
      (cardId: string): string => {
        const randomName = generateRandomFirstName();
        updateCard(cardId, (card) => ({ ...card, label: randomName }));
        return randomName;
      },
      [updateCard],
    );

    const activeCard = activeImageCardId
      ? (cards.find((card) => card.id === activeImageCardId) ?? null)
      : null;
    const activeAsset = activeCard ? imageMetadata[activeCard.id] : undefined;

    const handleImageDialogOpenChange = useCallback((nextOpen: boolean) => {
      if (!nextOpen) {
        setActiveImageCardId(null);
      }
    }, []);

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
      <div className="space-y-8">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Paramètres de la grille</CardTitle>
            <CardDescription>
              Ajustez les dimensions et l’identifiant avant de personnaliser les
              cartes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
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
            <Accordion
              type="single"
              collapsible
              className="w-full overflow-hidden rounded-md border border-border/70"
            >
              <AccordionItem value="advanced" className="border-b-0">
                <AccordionTrigger className="px-4">
                  Paramètres avancés
                </AccordionTrigger>
                <AccordionContent className="space-y-6 px-4">
                  <p className="text-sm text-muted-foreground">
                    Ajustez le nom public et l’identifiant technique si vous
                    partagez plusieurs configurations.
                  </p>
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
                    <div className="flex items-center justify-between gap-2">
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
                      Cet identifiant est intégré au lien partagé et aide à
                      retrouver la grille.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <p className="text-sm text-muted-foreground">
              La grille contiendra {rows * columns} cartes. Personnalisez-les en
              cliquant directement sur l’aperçu ci-dessous.
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader className="space-y-3 sm:flex sm:items-start sm:justify-between sm:space-y-0 sm:gap-4">
            <div className="space-y-1">
              <CardTitle>Cartes du plateau</CardTitle>
              <CardDescription>
                Cliquez sur une image pour l’illustrer et sur un nom pour le
                modifier. L’aperçu est directement éditable.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={handleGenerateRandomGrid}
            >
              <SparklesIcon aria-hidden="true" className="mr-2 size-4" />
              Remplir automatiquement
            </Button>
          </CardHeader>
          <CardContent>
            <EditableGridPreview
              grid={previewGrid}
              onCardLabelChange={handleCardLabelChange}
              onRandomLabel={handleRandomLabel}
              onRequestImageEdit={(cardId) => setActiveImageCardId(cardId)}
            />
          </CardContent>
        </Card>

        <CardImageEditorDialog
          card={activeCard}
          assetMetadata={activeAsset}
          open={Boolean(activeCard)}
          onOpenChange={handleImageDialogOpenChange}
          onCardChange={handleCardUpdate}
          onImageProcessed={handleImageProcessed}
          onImageCleared={handleImageCleared}
        />
      </div>
    );
  },
);

GridEditor.displayName = "GridEditor";
