"use client";

import { EyeIcon, UsersIcon } from "lucide-react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PlayerRole } from "@/lib/game/types";
import { roleLabels } from "./roomLabels";

export interface RoleSelectionSummary {
  name: string;
  details: string;
}

interface RoleSelectionScreenProps {
  gridSummary: RoleSelectionSummary | null;
  isAlreadyPlayer: boolean;
  isViewingAsSpectator: boolean;
  playerName: string | null;
  playerRole: PlayerRole | null;
  nickname: string;
  canJoinAsPlayer: boolean;
  isJoining: boolean;
  error: string | null;
  onNicknameChange(value: string): void;
  onConfirmPlayer(): void;
  onConfirmSpectator(): void;
}

export function RoleSelectionScreen({
  gridSummary,
  isAlreadyPlayer,
  isViewingAsSpectator,
  playerName,
  playerRole,
  nickname,
  canJoinAsPlayer,
  isJoining,
  error,
  onNicknameChange,
  onConfirmPlayer,
  onConfirmSpectator,
}: RoleSelectionScreenProps) {
  const trimmedNickname = nickname.trim();
  const playerLabel = playerRole ? roleLabels[playerRole] : null;
  const joinDisabled =
    !canJoinAsPlayer || trimmedNickname.length === 0 || isJoining;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (joinDisabled) {
      return;
    }
    onConfirmPlayer();
  };

  return (
    <div className="full-height-page flex min-h-0 flex-1 flex-col items-center justify-center gap-10 py-12">
      <section className="flex flex-col items-center gap-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <UsersIcon aria-hidden className="size-4" />
          Sélection du rôle
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Comment souhaitez-vous participer ?
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          Choisissez de rejoindre la salle comme joueur actif ou d’observer la
          partie sans manipuler les plateaux.
        </p>
        {gridSummary ? (
          <p className="text-sm text-muted-foreground">
            Plateau « {gridSummary.name} » — {gridSummary.details}
          </p>
        ) : null}
      </section>

      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Rejoindre en tant que joueur</CardTitle>
            <CardDescription>
              Affrontez votre adversaire en manipulant votre plateau dédié.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAlreadyPlayer ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Vous participez déjà en tant que
                  {playerLabel ? ` ${playerLabel.toLowerCase()}` : " joueur"}
                  {playerName ? ` « ${playerName} »` : ""}.
                </p>
                <p className="text-sm text-muted-foreground">
                  {isViewingAsSpectator
                    ? "Sélectionnez « Revenir en tant que joueur » pour reprendre le contrôle de votre plateau sur cet appareil."
                    : "Sélectionnez « Continuer en tant que joueur » pour accéder à votre plateau et finaliser la préparation."}
                </p>
                <Button type="button" onClick={onConfirmPlayer}>
                  <UsersIcon aria-hidden className="mr-2 size-4" />
                  {isViewingAsSpectator
                    ? "Revenir en tant que joueur"
                    : "Continuer en tant que joueur"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Prenez la prochaine place disponible pour affronter l’hôte.
                </p>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-2">
                    <label
                      htmlFor="role-selection-nickname"
                      className="text-sm font-medium text-foreground"
                    >
                      Votre pseudo
                    </label>
                    <input
                      id="role-selection-nickname"
                      type="text"
                      value={nickname}
                      onChange={(event) => onNicknameChange(event.target.value)}
                      className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Invité mystère"
                      maxLength={40}
                      autoComplete="off"
                      disabled={!canJoinAsPlayer || isJoining}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ce pseudo identifie votre plateau pendant la partie.
                    </p>
                  </div>
                  {error ? (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </div>
                  ) : null}
                  {!canJoinAsPlayer ? (
                    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      Les deux places de joueur sont déjà occupées. Choisissez
                      le mode spectateur pour suivre la partie.
                    </div>
                  ) : null}
                  <Button type="submit" disabled={joinDisabled}>
                    <UsersIcon aria-hidden className="mr-2 size-4" />
                    {isJoining ? "Connexion…" : "Rejoindre la partie"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Observer la partie</CardTitle>
            <CardDescription>
              Suivez le déroulement en direct sans intervenir sur les plateaux.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Visualisez les cartes retournées en temps réel et les actions des
              joueurs sans impacter la partie. Vous pourrez tenter de rejoindre
              plus tard si une place se libère.
            </p>
            {isAlreadyPlayer && !isViewingAsSpectator ? (
              <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Passer en mode spectateur désactive les interactions avec votre
                plateau sur cet appareil. Vous pourrez redevenir joueur à tout
                moment.
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={onConfirmSpectator}
            >
              <EyeIcon aria-hidden className="mr-2 size-4" />
              {isViewingAsSpectator
                ? "Continuer en spectateur"
                : "Observer la partie"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
