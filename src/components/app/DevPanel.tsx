"use client";

import {
  ActivityIcon,
  BugIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  HistoryIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import type { RoomPeerRuntimeState } from "@/app/room/[roomId]/hooks/useRoomPeerRuntime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RenderMetricsSnapshot } from "@/lib/debug/renderMetrics";
import type { DisconnectReason, PeerRole } from "@/lib/p2p/peer";
import { cn } from "@/lib/utils";

const isProduction = process.env.NODE_ENV === "production";
const isExplicitlyDisabled =
  typeof process !== "undefined" &&
  typeof process.env.NEXT_PUBLIC_DEV_PANEL === "string" &&
  process.env.NEXT_PUBLIC_DEV_PANEL.toLowerCase() === "off";

const MAX_HISTORY = 8;

interface RetryEventSnapshot {
  readonly attempt: number;
  readonly delayMs: number;
  readonly timestamp: number;
}

interface DisconnectEventSnapshot {
  readonly reason: DisconnectReason;
  readonly attempt: number;
  readonly timestamp: number;
}

export interface DevPanelProps {
  /** Identifier of the active room for contextual debugging. */
  readonly roomId: string;
  /** Declared peer role of the local player. */
  readonly peerRole: PeerRole | null;
  /** Latest runtime state coming from {@link useRoomPeerRuntime}. */
  readonly peerState: RoomPeerRuntimeState;
  /** Render cadence metrics for the surrounding component tree. */
  readonly renderMetrics: RenderMetricsSnapshot;
}

interface DiagnosticsRowProps {
  readonly label: string;
  readonly value: ReactNode;
}

const DiagnosticsRow = ({ label, value }: DiagnosticsRowProps) => (
  <div className="flex items-baseline justify-between gap-4 text-[11px]">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium text-foreground">{value}</span>
  </div>
);

const phaseBadgeVariant: Record<
  RoomPeerRuntimeState["phase"],
  "default" | "secondary" | "destructive"
> = {
  idle: "secondary",
  connecting: "default",
  connected: "default",
  reconnecting: "default",
  error: "destructive",
};

const phaseLabel: Record<RoomPeerRuntimeState["phase"], string> = {
  idle: "Au repos",
  connecting: "Connexion",
  connected: "Connecté",
  reconnecting: "Reconnexion",
  error: "Erreur",
};

const formatMilliseconds = (value: number | null): string => {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }
  if (!Number.isFinite(value)) {
    return "∞";
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }
  return `${value.toFixed(1)} ms`;
};

const shouldRenderPanel = !isProduction && !isExplicitlyDisabled;

export function DevPanel(props: DevPanelProps) {
  if (!shouldRenderPanel) {
    return null;
  }

  return <DevPanelInner {...props} />;
}

function DevPanelInner({
  roomId,
  peerRole,
  peerState,
  renderMetrics,
}: DevPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [retryHistory, setRetryHistory] = useState<
    readonly RetryEventSnapshot[]
  >([]);
  const [lastDisconnect, setLastDisconnect] =
    useState<DisconnectEventSnapshot | null>(null);

  useEffect(() => {
    if (peerState.phase === "error" || peerState.error) {
      setIsOpen(true);
    }
  }, [peerState.phase, peerState.error]);

  useEffect(() => {
    const runtime = peerState.runtime;
    setRetryHistory([]);
    setLastDisconnect(null);
    if (!runtime) {
      return;
    }

    const offRetry = runtime.events.on(
      "connection/retry",
      ({ attempt, delay }) => {
        setRetryHistory((previous) => {
          const next: RetryEventSnapshot[] = [
            { attempt, delayMs: delay, timestamp: Date.now() },
            ...previous,
          ];
          return next.slice(0, MAX_HISTORY);
        });
      },
    );

    const offDisconnected = runtime.events.on(
      "connection/disconnected",
      ({ reason, attempt }) => {
        setLastDisconnect({ reason, attempt, timestamp: Date.now() });
      },
    );

    return () => {
      offRetry();
      offDisconnected();
    };
  }, [peerState.runtime]);

  const timestampFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [],
  );

  const formatTimestamp = (timestamp: number | null): string => {
    if (!timestamp) {
      return "—";
    }
    return timestampFormatter.format(timestamp);
  };

  const phaseVariant = phaseBadgeVariant[peerState.phase];
  const phaseText = phaseLabel[peerState.phase];
  const latestRetry = retryHistory[0] ?? null;

  const protocolVersion = peerState.runtime?.protocolVersion ?? "—";
  const remotePeerId = peerState.remotePeerId ?? "—";
  const localPeerId = peerState.peerId ?? "—";
  const peerRoleLabel =
    peerRole === "host" ? "Hôte" : peerRole === "guest" ? "Invité" : "—";

  const retrySummary = useMemo(() => {
    if (!latestRetry) {
      return "Aucune tentative";
    }
    return `Tentative ${latestRetry.attempt} (${formatMilliseconds(latestRetry.delayMs)})`;
  }, [latestRetry]);

  const errorMessage = peerState.error?.message ?? null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col items-end gap-2">
      <Button
        type="button"
        size="sm"
        variant={isOpen ? "default" : "outline"}
        className="pointer-events-auto h-8 gap-2 rounded-full bg-background/80 backdrop-blur"
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <BugIcon aria-hidden className="size-3.5" />
        Panneau dev
        {isOpen ? (
          <ChevronDownIcon aria-hidden className="size-3" />
        ) : (
          <ChevronUpIcon aria-hidden className="size-3" />
        )}
      </Button>
      {isOpen ? (
        <Card className="pointer-events-auto w-full max-w-sm overflow-hidden border-border/70 bg-background/95 text-sm shadow-lg backdrop-blur">
          <CardHeader className="space-y-1 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ActivityIcon aria-hidden className="size-4 text-primary" />
              Diagnostic salle
            </CardTitle>
            <CardDescription className="text-xs">
              Salle {roomId || "—"} · Rôle {peerRoleLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-5 text-xs">
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Connexion
                </span>
                <Badge variant={phaseVariant}>{phaseText}</Badge>
              </div>
              <div className="space-y-1.5">
                <DiagnosticsRow label="Peer local" value={localPeerId} />
                <DiagnosticsRow label="Peer distant" value={remotePeerId} />
                <DiagnosticsRow
                  label="Version protocole"
                  value={protocolVersion}
                />
                <DiagnosticsRow
                  label="Dernière erreur"
                  value={errorMessage ?? "Aucune"}
                />
              </div>
            </section>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Reconnexion ICE
                </span>
                <Badge variant={latestRetry ? "default" : "secondary"}>
                  {retrySummary}
                </Badge>
              </div>
              <div
                className={cn(
                  "grid gap-1.5",
                  retryHistory.length === 0 && "text-muted-foreground",
                )}
              >
                {retryHistory.length === 0 ? (
                  <p className="text-[11px]">Aucune tentative enregistrée.</p>
                ) : (
                  retryHistory.map((event) => (
                    <div
                      key={`${event.timestamp}-${event.attempt}`}
                      className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 px-2 py-1"
                    >
                      <div className="flex items-center gap-2 text-[11px]">
                        <HistoryIcon
                          aria-hidden
                          className="size-3 text-muted-foreground"
                        />
                        <span>Tentative {event.attempt}</span>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground">
                        <div>{formatMilliseconds(event.delayMs)}</div>
                        <div>{formatTimestamp(event.timestamp)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <DiagnosticsRow
                label="Dernière coupure"
                value={
                  lastDisconnect
                    ? `${lastDisconnect.reason} (#${lastDisconnect.attempt}) · ${formatTimestamp(lastDisconnect.timestamp)}`
                    : "Aucune"
                }
              />
            </section>
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Rendu React
                </span>
                <Badge variant="secondary">
                  {formatTimestamp(renderMetrics.lastRenderTimestamp)}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <DiagnosticsRow
                  label="Compteurs"
                  value={`#${renderMetrics.renderCount}`}
                />
                <DiagnosticsRow
                  label="Intervalle dernier"
                  value={formatMilliseconds(renderMetrics.lastRenderIntervalMs)}
                />
                <DiagnosticsRow
                  label="Intervalle moyen"
                  value={formatMilliseconds(
                    renderMetrics.averageRenderIntervalMs,
                  )}
                />
              </div>
            </section>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
