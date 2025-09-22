"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CopyIcon,
  KeySquareIcon,
  LinkIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GridPreview } from "@/components/editor/GridPreview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildInviteUrl, encodeGridToToken } from "@/lib/share/url";
import type { HostPreparationRecord } from "@/lib/storage/session";
import { loadHostPreparation } from "@/lib/storage/session";

const formatDateTime = (timestamp: number): string => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "Date inconnue";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Date inconnue";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (error) {
    console.error("Impossible de formater la date de création.", error);
    return date.toISOString();
  }
};

type CopyTarget = "url" | "token";

type CopyFeedback =
  | { target: CopyTarget; status: "success"; message: string }
  | { target: CopyTarget; status: "error"; message: string };

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const rawRoomId = params?.roomId;
  const roomId = typeof rawRoomId === "string" ? rawRoomId : "";

  const [hostPreparation, setHostPreparation] =
    useState<HostPreparationRecord | null>(null);
  const [loadState, setLoadState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState<string | null>(null);
  const [copying, setCopying] = useState<CopyTarget | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback | null>(null);

  useEffect(() => {
    setLoadState("loading");

    if (!roomId) {
      setHostPreparation(null);
      setLoadError(
        "Identifiant de salle invalide. Retournez à la création pour recommencer.",
      );
      setLoadState("error");
      return;
    }

    const preparation = loadHostPreparation(roomId);
    if (!preparation) {
      setHostPreparation(null);
      setLoadError(
        "Cette salle n’a pas été trouvée sur cet appareil. Créez une nouvelle partie depuis la page de configuration.",
      );
      setLoadState("error");
      return;
    }

    setHostPreparation(preparation);
    setLoadError(null);
    setLoadState("ready");
  }, [roomId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setAppOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!copyFeedback) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setCopyFeedback(null);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [copyFeedback]);

  const { token, tokenError } = useMemo(() => {
    if (!hostPreparation) {
      return {
        token: null as string | null,
        tokenError: null as string | null,
      };
    }

    try {
      const nextToken = encodeGridToToken(hostPreparation.grid);
      return { token: nextToken, tokenError: null };
    } catch (error) {
      console.error("Impossible de générer le token de partage.", error);
      return {
        token: null,
        tokenError:
          error instanceof Error
            ? error.message
            : "Impossible de générer le token de partage pour cette grille.",
      };
    }
  }, [hostPreparation]);

  const inviteUrl = useMemo(() => {
    if (!token || !appOrigin) {
      return null;
    }
    return buildInviteUrl(appOrigin, token);
  }, [appOrigin, token]);

  const gridSummary = useMemo(() => {
    if (!hostPreparation) {
      return null;
    }

    const { grid, assets } = hostPreparation;
    const cardsWithImages = grid.cards.reduce((total, card) => {
      return card.imageUrl ? total + 1 : total;
    }, 0);

    return {
      dimensions: `${grid.rows} × ${grid.columns}`,
      totalCards: grid.cards.length,
      cardsWithImages,
      storedAssets: Object.keys(assets).length,
    };
  }, [hostPreparation]);

  const createdAtLabel = useMemo(() => {
    if (!hostPreparation) {
      return null;
    }
    return formatDateTime(hostPreparation.createdAt);
  }, [hostPreparation]);

  const handleCopy = useCallback(async (value: string, target: CopyTarget) => {
    setCopying(target);
    setCopyFeedback(null);

    try {
      if (
        !navigator.clipboard ||
        typeof navigator.clipboard.writeText !== "function"
      ) {
        throw new Error(
          "Le presse-papiers n’est pas disponible dans ce navigateur. Copiez manuellement le contenu.",
        );
      }

      await navigator.clipboard.writeText(value);
      setCopyFeedback({
        target,
        status: "success",
        message:
          target === "url"
            ? "Lien d’invitation copié dans le presse-papiers."
            : "Token copié dans le presse-papiers.",
      });
    } catch (error) {
      console.error("Impossible de copier dans le presse-papiers.", error);
      setCopyFeedback({
        target,
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de copier dans le presse-papiers.",
      });
    } finally {
      setCopying(null);
    }
  }, []);

  const isLoading = loadState === "loading" || loadState === "idle";

  return (
    <div className="flex flex-col gap-10">
      <section className="space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <KeySquareIcon aria-hidden="true" className="size-4" />
          Salle KeyS prête à partager
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Invitez vos joueurs et préparez le lancement
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Partagez le lien d’invitation ou le token pour permettre à vos invités
          de rejoindre la partie. Vous pouvez garder cette page ouverte pour
          suivre la configuration et démarrer la synchronisation P2P.
        </p>
      </section>

      {isLoading ? (
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border border-border/70">
            <CardHeader className="space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-2/3" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-9 w-32" />
            </CardContent>
          </Card>
          <Card className="border border-border/70">
            <CardHeader className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {loadState === "error" && loadError ? (
        <Card className="border border-destructive/40 bg-destructive/5">
          <CardHeader className="flex flex-row items-start gap-3">
            <AlertCircleIcon
              aria-hidden="true"
              className="mt-1 size-5 text-destructive"
            />
            <div className="space-y-2">
              <CardTitle className="text-lg text-destructive">
                Impossible d’ouvrir la salle
              </CardTitle>
              <CardDescription className="text-sm text-destructive">
                {loadError}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/create">Revenir à la configuration</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {loadState === "ready" && hostPreparation ? (
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border border-border/70">
            <CardHeader>
              <CardTitle>Coordonnées de la salle</CardTitle>
              <CardDescription>
                Transmettez ces informations à vos invités et conservez cette
                page ouverte jusqu’au lancement de la partie.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                  <span className="block text-xs font-medium uppercase text-muted-foreground">
                    Identifiant de salle
                  </span>
                  <span className="font-mono text-foreground">{roomId}</span>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                  <span className="block text-xs font-medium uppercase text-muted-foreground">
                    Animateur
                  </span>
                  <span className="text-foreground">
                    {hostPreparation.nickname}
                  </span>
                </div>
                {createdAtLabel ? (
                  <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      Créée le
                    </span>
                    <span className="text-foreground">{createdAtLabel}</span>
                  </div>
                ) : null}
                {gridSummary ? (
                  <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      Cartes prêtes
                    </span>
                    <span className="text-foreground">
                      {gridSummary.totalCards} cartes ({gridSummary.dimensions})
                    </span>
                  </div>
                ) : null}
              </div>

              {tokenError ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircleIcon
                    aria-hidden="true"
                    className="mt-0.5 size-4"
                  />
                  <span>{tokenError}</span>
                </div>
              ) : token ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      Token de partage
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <code className="flex-1 overflow-hidden text-ellipsis rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm font-mono">
                        {token}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        className="sm:flex-none"
                        onClick={() => handleCopy(token, "token")}
                        disabled={copying === "token"}
                      >
                        <CopyIcon aria-hidden="true" className="mr-2 size-4" />
                        Copier le token
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      Lien d’invitation
                    </span>
                    {inviteUrl ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <code className="flex-1 overflow-hidden text-ellipsis rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm font-mono">
                          {inviteUrl}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          className="sm:flex-none"
                          onClick={() => handleCopy(inviteUrl, "url")}
                          disabled={copying === "url"}
                        >
                          <LinkIcon
                            aria-hidden="true"
                            className="mr-2 size-4"
                          />
                          Copier le lien
                        </Button>
                      </div>
                    ) : (
                      <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                        Le lien complet sera affiché dès que l’origine du site
                        sera disponible. Le token reste suffisant pour inviter
                        vos joueurs via la page Rejoindre.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {copyFeedback ? (
                <div
                  className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                    copyFeedback.status === "success"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "border-destructive/40 bg-destructive/10 text-destructive"
                  }`}
                >
                  {copyFeedback.status === "success" ? (
                    <CheckCircle2Icon
                      aria-hidden="true"
                      className="mt-0.5 size-4"
                    />
                  ) : (
                    <AlertCircleIcon
                      aria-hidden="true"
                      className="mt-0.5 size-4"
                    />
                  )}
                  <span>{copyFeedback.message}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border border-border/70">
            <CardHeader>
              <CardTitle>Aperçu du plateau</CardTitle>
              <CardDescription>
                Cette vue correspond à ce que verront vos invités au lancement
                de la partie.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {gridSummary ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      Cartes avec visuel
                    </span>
                    <span className="text-foreground">
                      {gridSummary.cardsWithImages} / {gridSummary.totalCards}
                    </span>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      Assets locaux
                    </span>
                    <span className="text-foreground">
                      {gridSummary.storedAssets}
                    </span>
                  </div>
                </div>
              ) : null}
              <GridPreview grid={hostPreparation.grid} />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
