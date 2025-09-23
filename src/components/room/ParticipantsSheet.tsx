"use client";

import {
  CrownIcon,
  EyeIcon,
  ShieldIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Player, PlayerRole } from "@/lib/game/types";
import type { SpectatorProfile } from "@/lib/room/spectators";
import { cn } from "@/lib/utils";

type PlayerSummary = {
  readonly player: Player;
  readonly ready: boolean;
  readonly isLocal: boolean;
  readonly isActive: boolean;
};

type SpectatorSummary = SpectatorProfile;

type ParticipantsSheetProps = {
  readonly players: readonly PlayerSummary[];
  readonly spectators: readonly SpectatorSummary[];
  readonly statusLabel: string;
  readonly turnLabel: string;
  readonly isHost: boolean;
  readonly canPromoteSpectators: boolean;
  readonly canKickPlayers: boolean;
  readonly onPromoteSpectator?: (spectatorId: string) => void;
  readonly onKickSpectator?: (spectatorId: string) => void;
  readonly onKickPlayer?: (playerId: string) => void;
  readonly triggerClassName?: string;
};

const roleLabels: Record<PlayerRole, string> = {
  host: "Hôte",
  guest: "Invité",
};

function PlayerRow({
  summary,
  isHost,
  canKick,
  onKick,
}: {
  summary: PlayerSummary;
  isHost: boolean;
  canKick: boolean;
  onKick?: (playerId: string) => void;
}) {
  const { player, ready, isLocal, isActive } = summary;
  const canShowKickButton =
    isHost &&
    canKick &&
    typeof onKick === "function" &&
    player.role !== PlayerRole.Host;
  const badgeItems = [
    ready
      ? {
          key: "ready",
          label: "Prêt",
          className: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
        }
      : {
          key: "pending",
          label: "À préparer",
          className: "border-dashed text-muted-foreground",
          variant: "outline" as const,
        },
    isLocal
      ? {
          key: "local",
          label: "Vous",
          className: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
        }
      : null,
    isActive
      ? {
          key: "active",
          label: "Tour en cours",
          className: "bg-primary/15 text-primary",
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    className: string;
    variant?: "outline";
  }>;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {player.role === "host" ? (
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CrownIcon aria-hidden className="size-4" />
            </span>
          ) : (
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UsersIcon aria-hidden className="size-4" />
            </span>
          )}
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{player.name}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {roleLabels[player.role]}
            </p>
          </div>
        </div>
        {canShowKickButton ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onKick(player.id)}
          >
            <UserMinusIcon aria-hidden className="mr-2 size-4" />
            Exclure
          </Button>
        ) : null}
      </div>
      {badgeItems.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {badgeItems.map((badge) => (
            <Badge
              key={badge.key}
              variant={badge.variant}
              className={cn("text-xs", badge.className)}
            >
              {badge.label}
            </Badge>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function SpectatorRow({
  spectator,
  isHost,
  canPromote,
  onPromote,
  onKick,
}: {
  spectator: SpectatorSummary;
  isHost: boolean;
  canPromote: boolean;
  onPromote?: (spectatorId: string) => void;
  onKick?: (spectatorId: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <EyeIcon aria-hidden className="size-4" />
        </span>
        <div className="space-y-0.5">
          <p className="font-medium text-foreground">{spectator.name}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Spectateur
          </p>
        </div>
      </div>
      {isHost ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPromote?.(spectator.id)}
            disabled={!canPromote || !onPromote}
          >
            <UserPlusIcon aria-hidden className="mr-2 size-4" />
            Promouvoir
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onKick?.(spectator.id)}
            disabled={!onKick}
          >
            <UserMinusIcon aria-hidden className="mr-2 size-4" />
            Retirer
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function ParticipantsSheet({
  players,
  spectators,
  statusLabel,
  turnLabel,
  isHost,
  canPromoteSpectators,
  canKickPlayers,
  onPromoteSpectator,
  onKickSpectator,
  onKickPlayer,
  triggerClassName,
}: ParticipantsSheetProps) {
  const playerCount = players.length;
  const hostPlayer = useMemo(
    () => players.find((summary) => summary.player.role === "host") ?? null,
    [players],
  );
  const guestPlayer = useMemo(
    () => players.find((summary) => summary.player.role === "guest") ?? null,
    [players],
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("flex items-center gap-2", triggerClassName)}
        >
          <UsersIcon aria-hidden className="size-4" />
          Participants ({playerCount}/2)
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="flex max-h-[88vh] flex-col gap-0 rounded-t-3xl border-l-0 border-t px-0 pb-4 pt-2 sm:max-w-md sm:rounded-none sm:border-l sm:border-t-0 sm:px-0"
      >
        <SheetHeader className="border-b px-6 pb-4 pt-2">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <ShieldIcon aria-hidden className="size-5 text-primary" />
            Participants et rôles
          </SheetTitle>
          <SheetDescription asChild className="space-y-1">
            <div>
              <p className="m-0">
                Suivez les connexions et gérez les accès à la partie.
              </p>
              <p className="m-0 text-xs text-muted-foreground">
                {statusLabel} — {turnLabel}
              </p>
            </div>
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6 pb-4">
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <CrownIcon aria-hidden className="size-4" />
                Hôte
              </h3>
              <ul className="space-y-3">
                {hostPlayer ? (
                  <PlayerRow
                    summary={hostPlayer}
                    isHost={isHost}
                    canKick={isHost && canKickPlayers}
                    onKick={onKickPlayer}
                  />
                ) : (
                  <li className="rounded-md border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    Aucun hôte connecté actuellement.
                  </li>
                )}
              </ul>
            </section>
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <UsersIcon aria-hidden className="size-4" />
                Invité
              </h3>
              <ul className="space-y-3">
                {guestPlayer ? (
                  <PlayerRow
                    summary={guestPlayer}
                    isHost={isHost}
                    canKick={isHost && canKickPlayers}
                    onKick={onKickPlayer}
                  />
                ) : (
                  <li className="rounded-md border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                    En attente d’un invité.
                  </li>
                )}
              </ul>
            </section>
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <EyeIcon aria-hidden className="size-4" />
                Spectateurs ({spectators.length})
              </h3>
              {spectators.length > 0 ? (
                <ul className="space-y-2">
                  {spectators.map((spectator) => (
                    <SpectatorRow
                      key={spectator.id}
                      spectator={spectator}
                      isHost={isHost}
                      canPromote={canPromoteSpectators}
                      onPromote={onPromoteSpectator}
                      onKick={onKickSpectator}
                    />
                  ))}
                </ul>
              ) : (
                <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Aucun spectateur pour le moment.
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export { ParticipantsSheet };
