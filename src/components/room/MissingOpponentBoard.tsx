"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Grid } from "@/lib/game/types";

interface MissingOpponentBoardProps {
  grid: Grid | null;
}

export function MissingOpponentBoard({ grid }: MissingOpponentBoardProps) {
  return (
    <Card className="flex h-full flex-col border-dashed border-border/70 bg-muted/20">
      <CardHeader>
        <CardTitle>En attente d’un adversaire</CardTitle>
        <CardDescription>
          {grid
            ? `Le plateau ${grid.rows} × ${grid.columns} est prêt à être partagé.`
            : "Configurez un plateau pour démarrer la partie."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-center gap-3">
        <p className="text-sm text-muted-foreground">
          Invitez un joueur à rejoindre cette salle pour afficher son plateau et
          démarrer la partie.
        </p>
      </CardContent>
    </Card>
  );
}
