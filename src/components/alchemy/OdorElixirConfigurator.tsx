"use client";

import { AtomIcon, InfoIcon } from "lucide-react";
import { useMemo } from "react";

import { SortableShalgemonList } from "@/components/alchemy/SortableShalgemonList";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SHALGEMON_CATALOG } from "@/lib/alchemy/catalog";

/**
 * Presents the olfactory research interface used as a reference for the
 * chromatic potion. No selection is required: the list is provided purely for
 * consultation with sortable columns.
 */
function OdorElixirConfigurator() {
  const odorProfiles = useMemo(() => SHALGEMON_CATALOG.slice(0), []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AtomIcon aria-hidden="true" className="size-5 text-primary" />
          Élixir d’odeur
        </CardTitle>
        <CardDescription>
          Référence olfactive utilisée par le laboratoire. Les colonnes peuvent
          être triées pour identifier rapidement les harmonies aromatiques.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4" />
          <p>
            L’élixir d’odeur ne nécessite pas de sélection : la liste ci-dessous
            sert de référentiel commun à toute l’équipe.
          </p>
        </div>
        <SortableShalgemonList
          shalgemons={odorProfiles}
          initialSort={{ key: "odor", direction: "asc" }}
          emphasis="odor"
          aria-label="Référentiel aromatique des Shalgémon"
        />
        <p className="text-sm text-muted-foreground">
          Astuce : associez des notes complémentaires à la palette chromatique
          afin d’éviter les interférences sensorielles lorsqu’une potion est
          vaporisée.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Notes clés :</span>
          {["floral", "minéral", "épices", "résineux", "métallique"].map(
            (note) => (
              <Badge key={note} variant="outline">
                {note}
              </Badge>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export { OdorElixirConfigurator };
