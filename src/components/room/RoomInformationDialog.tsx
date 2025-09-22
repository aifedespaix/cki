"use client";

import { InfoIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { GameStatus, Grid } from "@/lib/game/types";
import { cn } from "@/lib/utils";

import { formatStatusLabel } from "./roomLabels";

interface RoomInformationDialogProps {
  roomId: string;
  grid: Grid;
  status: GameStatus;
  hostName: string | null;
  triggerClassName?: string;
}

export function RoomInformationDialog({
  roomId,
  grid,
  status,
  hostName,
  triggerClassName,
}: RoomInformationDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("flex items-center gap-2", triggerClassName)}
        >
          <InfoIcon aria-hidden className="size-4" />
          Infos salle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Informations sur la salle</DialogTitle>
          <DialogDescription>
            Récapitulatif du plateau et des paramètres de cette partie.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 text-sm">
          <div className="grid gap-3">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Identifiant
              </span>
              <code className="inline-flex items-center rounded bg-muted px-2 py-1 text-xs font-mono">
                {roomId}
              </code>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Plateau
              </span>
              <p className="text-foreground">
                {grid.name} — {grid.rows} × {grid.columns} ({grid.cards.length}{" "}
                cartes)
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Hôte
              </span>
              <p className="text-foreground">{hostName ?? "Hôte inconnu"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                État
              </span>
              <p className="text-foreground">{formatStatusLabel(status)}</p>
            </div>
          </div>
          <p className="text-muted-foreground">
            La salle reste active tant que les participants conservent cette
            page ouverte. Les échanges se synchronisent directement entre
            appareils via une connexion chiffrée de navigateur à navigateur.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
