"use client";

import { AlertCircleIcon, PaletteIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { SortableShalgemonList } from "@/components/alchemy/SortableShalgemonList";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SHALGEMON_CATALOG } from "@/lib/alchemy/catalog";
import type { Shalgemon } from "@/lib/alchemy/types";

const MAX_SELECTION = 3;

const formatList = (values: string[]): string => {
  if (values.length === 0) {
    return "aucune";
  }
  if (values.length === 1) {
    return values[0];
  }
  const head = values.slice(0, -1);
  const tail = values[values.length - 1];
  return `${head.join(", ")} et ${tail}`;
};

const computeChromaticPalette = (shalgemons: Shalgemon[]): string[] => {
  const palette = new Set<string>();
  for (const shalgemon of shalgemons) {
    for (const tone of shalgemon.chromaticAffinity) {
      palette.add(tone);
    }
  }
  return Array.from(palette).sort((first, second) =>
    first.localeCompare(second, "fr", { sensitivity: "base" }),
  );
};

/**
 * Provides the interface for selecting the Shalgémon used to infuse the potion
 * chromatique. The selection is limited and the resulting chromatic palette is
 * displayed to guide the alchemist.
 */
function ChromaticPotionConfigurator() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  const selectedShalgemons = useMemo(
    () => SHALGEMON_CATALOG.filter((entry) => selectedIds.includes(entry.id)),
    [selectedIds],
  );

  const palette = useMemo(
    () => computeChromaticPalette(selectedShalgemons),
    [selectedShalgemons],
  );

  const averageStability = useMemo(() => {
    if (selectedShalgemons.length === 0) {
      return null;
    }
    const sum = selectedShalgemons.reduce(
      (accumulator, shalgemon) => accumulator + shalgemon.stabilityIndex,
      0,
    );
    return Math.round(sum / selectedShalgemons.length);
  }, [selectedShalgemons]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedIds(ids);
    setLimitMessage(null);
  }, []);

  const handleSelectionLimitExceeded = useCallback(() => {
    setLimitMessage(
      `La potion chromatique ne supporte que ${MAX_SELECTION} essences simultanées.`,
    );
  }, []);

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PaletteIcon aria-hidden="true" className="size-5 text-primary" />
          Potion chromatique
        </CardTitle>
        <CardDescription>
          Choisissez jusqu’à trois Shalgémon afin de stabiliser le spectre de la
          potion. Le classement est triable pour vous aider à équilibrer la
          mixture.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <SortableShalgemonList
          shalgemons={SHALGEMON_CATALOG}
          selectedIds={selectedIds}
          onSelectionChange={handleSelectionChange}
          selectionLimit={MAX_SELECTION}
          onSelectionLimitExceeded={handleSelectionLimitExceeded}
          initialSort={{ key: "chromatic", direction: "asc" }}
          emphasis="chromatic"
          aria-label="Sélection des Shalgémon pour la potion chromatique"
        />
        {limitMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:border-amber-400/60 dark:bg-amber-400/10 dark:text-amber-100"
          >
            <AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4" />
            <span>{limitMessage}</span>
          </div>
        ) : null}
        <Separator />
        <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Essences sélectionnées</h3>
            {selectedShalgemons.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sélectionnez au moins un Shalgémon pour prévisualiser les effets
                chromatiques et la stabilité projetée de la potion.
              </p>
            ) : (
              <ul className="space-y-2">
                {selectedShalgemons.map((shalgemon) => (
                  <li
                    key={shalgemon.id}
                    className="rounded-md border border-border/60 bg-background/80 p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium leading-tight">
                          {shalgemon.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tempérament : {shalgemon.temperament}
                        </p>
                      </div>
                      <Badge variant="secondary">{shalgemon.rarity}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Don principal : {shalgemon.signatureSkill}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-3 rounded-md border border-border/60 bg-background/80 p-4 shadow-sm">
            <h3 className="text-base font-semibold">Synthèse chromatique</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Palette obtenue :
                <br />
                <span className="font-medium text-foreground">
                  {formatList(palette)}
                </span>
              </p>
              <p>
                Stabilité moyenne :
                <br />
                <span className="font-medium text-foreground">
                  {averageStability !== null
                    ? `${averageStability}%`
                    : "Non calculée"}
                </span>
              </p>
              <p>
                Conseils : privilégiez des tonalités complémentaires pour éviter
                les halos instables. Ajustez avec une essence de soutien si la
                stabilité descend sous 60%.
              </p>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

export { ChromaticPotionConfigurator };
