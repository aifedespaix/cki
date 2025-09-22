"use client";

import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CopyIcon,
  EyeIcon,
  TimerIcon,
  UsersIcon,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

import {
  type HeaderActionState,
  type HeaderInviteActionStatus,
  useHeaderActionRegistration,
} from "@/components/app/HeaderActionsContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Grid } from "@/lib/game/types";
import { buildInviteUrl, encodeGridToToken } from "@/lib/share/url";
import { cn } from "@/lib/utils";

type CopyStatus = HeaderInviteActionStatus;

export interface HostIdentitySummary {
  id: string;
  name: string;
}

interface InviteDialogProps {
  grid: Grid | null;
  roomId: string | null;
  host: HostIdentitySummary | null;
  canShare: boolean;
  allowJoin: boolean;
  canJoinAsPlayer: boolean;
  onJoin: (nickname: string) => void;
  isJoining: boolean;
  triggerClassName?: string;
}

type JoinRole = "player" | "spectator";

interface JoinAsGuestFormProps {
  hostName: string;
  onJoin: (nickname: string) => void;
  disabled: boolean;
  isSubmitting: boolean;
  canJoinAsPlayer: boolean;
}

export function InviteDialog({
  grid,
  roomId,
  host,
  canShare,
  allowJoin,
  canJoinAsPlayer,
  onJoin,
  isJoining,
  triggerClassName,
}: InviteDialogProps) {
  const [origin, setOrigin] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setOrigin(window.location.origin);
  }, []);

  const sharePayload = useMemo(() => {
    if (!grid) {
      return { token: null as string | null, error: null as string | null };
    }
    try {
      const token = encodeGridToToken(grid);
      return { token, error: null };
    } catch (error) {
      console.error("Impossible de générer le code d’invitation.", error);
      return {
        token: null,
        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue lors de la génération du code.",
      };
    }
  }, [grid]);

  const inviteUrl = useMemo(() => {
    if (!sharePayload.token || !origin || !roomId || !host) {
      return null;
    }
    try {
      return buildInviteUrl(
        origin,
        { roomId, hostId: host.id, hostName: host.name },
        sharePayload.token,
      );
    } catch (error) {
      console.error("Impossible de construire l’URL d’invitation.", error);
      return null;
    }
  }, [origin, sharePayload.token, roomId, host]);

  useEffect(() => {
    if (inviteUrl === null) {
      setCopyStatus("idle");
      setCopyError(null);
      return;
    }
    setCopyStatus("idle");
    setCopyError(null);
  }, [inviteUrl]);

  useEffect(() => {
    if (copyStatus !== "copied") {
      return;
    }
    const timeout = window.setTimeout(() => {
      setCopyStatus("idle");
    }, 2500);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const handleCopy = useCallback(async () => {
    if (!inviteUrl) {
      return;
    }
    setCopyError(null);
    setCopyStatus("pending");
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      setCopyStatus("error");
      setCopyError(
        "Copie automatique indisponible : sélectionnez le lien et copiez-le manuellement.",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus("copied");
      setCopyError(null);
    } catch (error) {
      console.error("Impossible de copier le lien d’invitation.", error);
      setCopyStatus("error");
      setCopyError(
        "Impossible de copier automatiquement le lien. Sélectionnez-le et copiez-le manuellement.",
      );
    }
  }, [inviteUrl]);

  const inviteHeaderAction = useMemo<HeaderActionState>(() => {
    if (!canShare) {
      return {};
    }
    const hasInviteGenerationError = Boolean(sharePayload.error);
    const isInviteAvailable = Boolean(inviteUrl);
    if (!hasInviteGenerationError && !isInviteAvailable) {
      return {};
    }

    return {
      invite: {
        label: hasInviteGenerationError
          ? "Lien indisponible"
          : "Copier le lien",
        ariaLabel: hasInviteGenerationError
          ? "Le lien d’invitation est actuellement indisponible"
          : "Copier le lien d’invitation de cette salle",
        icon: CopyIcon,
        onActivate: handleCopy,
        status: hasInviteGenerationError ? "error" : copyStatus,
        disabled:
          hasInviteGenerationError ||
          !isInviteAvailable ||
          copyStatus === "pending",
        pendingLabel: "Copie en cours…",
        successLabel: "Lien copié",
        errorLabel: hasInviteGenerationError ? "Lien indisponible" : undefined,
        feedbackMessage:
          copyStatus === "copied"
            ? "Lien d’invitation copié dans le presse-papier."
            : copyStatus === "error"
              ? (copyError ??
                "Impossible de copier automatiquement le lien d’invitation.")
              : hasInviteGenerationError
                ? `Impossible de générer le lien d’invitation : ${sharePayload.error}`
                : null,
        feedbackTone:
          copyStatus === "error" || hasInviteGenerationError
            ? "assertive"
            : "polite",
      },
    };
  }, [
    canShare,
    copyError,
    copyStatus,
    handleCopy,
    inviteUrl,
    sharePayload.error,
  ]);
  useHeaderActionRegistration(inviteHeaderAction);

  if (!grid) {
    return null;
  }

  const hasTokenError = Boolean(sharePayload.error);
  const invitePlaceholder = hasTokenError
    ? "Erreur lors de la génération du lien"
    : "Le lien apparaîtra ici dès qu’il est prêt.";
  const hostName = host?.name ?? "Hôte";
  const isSubmitting = isJoining;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("flex items-center gap-2", triggerClassName)}
        >
          <CopyIcon aria-hidden className="size-4" />
          Inviter
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Inviter un adversaire</DialogTitle>
          <DialogDescription>
            Partagez ce lien pour permettre à un joueur de rejoindre la salle et
            importer automatiquement le plateau « {grid.name} ».
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="invite-link"
              className="text-sm font-medium text-foreground"
            >
              Lien d’invitation
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                id="invite-link"
                type="text"
                value={inviteUrl ?? ""}
                readOnly
                placeholder={invitePlaceholder}
                onFocus={(event) => event.currentTarget.select()}
                spellCheck={false}
                className="w-full flex-1 rounded-md border border-border/70 bg-background px-3 py-2 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                aria-invalid={hasTokenError || copyStatus === "error"}
                aria-describedby={
                  hasTokenError
                    ? "invite-link-error"
                    : copyStatus === "error" && copyError
                      ? "invite-link-copy-error"
                      : undefined
                }
                disabled={!canShare}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                disabled={!inviteUrl || !canShare || copyStatus === "pending"}
                className="sm:w-auto sm:flex-none"
              >
                {copyStatus === "copied" ? (
                  <>
                    <CheckCircle2Icon aria-hidden className="mr-2 size-4" />
                    Lien copié
                  </>
                ) : copyStatus === "pending" ? (
                  <>
                    <TimerIcon
                      aria-hidden
                      className="mr-2 size-4 animate-spin"
                    />
                    Copie…
                  </>
                ) : (
                  <>
                    <CopyIcon aria-hidden className="mr-2 size-4" />
                    Copier
                  </>
                )}
              </Button>
            </div>
            {sharePayload.token ? (
              <p className="text-xs text-muted-foreground">
                Code compressé :{" "}
                <code className="break-all rounded bg-muted px-1 py-0.5">
                  {sharePayload.token}
                </code>
              </p>
            ) : null}
            {hasTokenError ? (
              <div
                id="invite-link-error"
                className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                aria-live="polite"
              >
                <AlertCircleIcon aria-hidden className="mt-0.5 size-4" />
                <span>
                  Impossible de générer le lien d’invitation.{" "}
                  {sharePayload.error}
                </span>
              </div>
            ) : canShare ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRightIcon aria-hidden className="size-4" />
                Les invités peuvent ouvrir ce lien sur n’importe quel appareil
                pour importer automatiquement votre plateau.
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <EyeIcon aria-hidden className="size-4" />
                Seul l’hôte peut partager ce lien depuis cet appareil.
              </p>
            )}
            {copyStatus === "error" && copyError ? (
              <p
                id="invite-link-copy-error"
                className="text-sm text-destructive"
                aria-live="polite"
              >
                {copyError}
              </p>
            ) : null}
          </div>
          {allowJoin ? (
            <div className="space-y-4 border-t border-border/60 pt-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Rejoindre la salle de {hostName}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Sélectionnez votre rôle puis choisissez un pseudo si vous
                  souhaitez affronter l’hôte.
                </p>
                {!canJoinAsPlayer ? (
                  <p className="text-xs text-muted-foreground">
                    La place de joueur est déjà occupée. Vous pouvez néanmoins
                    observer la partie en tant que spectateur.
                  </p>
                ) : null}
              </div>
              <JoinAsGuestForm
                hostName={hostName}
                onJoin={onJoin}
                disabled={!allowJoin || isJoining}
                isSubmitting={isSubmitting}
                canJoinAsPlayer={canJoinAsPlayer}
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JoinAsGuestForm({
  hostName,
  onJoin,
  disabled,
  isSubmitting,
  canJoinAsPlayer,
}: JoinAsGuestFormProps) {
  const [nickname, setNickname] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<JoinRole>(
    canJoinAsPlayer ? "player" : "spectator",
  );
  const roleFieldId = useId();
  const playerOptionId = `${roleFieldId}-player`;
  const spectatorOptionId = `${roleFieldId}-spectator`;

  useEffect(() => {
    if (!canJoinAsPlayer) {
      setSelectedRole("spectator");
    }
  }, [canJoinAsPlayer]);

  const handleRoleChange = useCallback((role: JoinRole) => {
    setSelectedRole(role);
    setLocalError(null);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || selectedRole !== "player") {
      return;
    }
    const trimmed = nickname.trim();
    if (!trimmed) {
      setLocalError("Veuillez renseigner un pseudo pour rejoindre la salle.");
      return;
    }
    try {
      onJoin(trimmed);
      setLocalError(null);
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "Impossible de rejoindre la salle. Réessayez dans un instant.",
      );
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-foreground">
          Choisissez comment participer
        </legend>
        <div className="space-y-2">
          <label
            htmlFor={playerOptionId}
            className={cn(
              "flex items-start gap-3 rounded-md border px-3 py-3 text-sm transition-colors",
              selectedRole === "player"
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border/70 bg-background",
              canJoinAsPlayer && !disabled
                ? "cursor-pointer hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
                : "cursor-not-allowed opacity-60",
            )}
          >
            <input
              id={playerOptionId}
              type="radio"
              name={`${roleFieldId}-role`}
              value="player"
              checked={selectedRole === "player"}
              onChange={() => handleRoleChange("player")}
              disabled={disabled || isSubmitting || !canJoinAsPlayer}
              className="mt-1 h-4 w-4 border-border/70 text-primary focus:ring-ring"
            />
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">Joueur</span>
              <span className="text-xs text-muted-foreground">
                Défiez l’hôte sur ce plateau personnalisé.
              </span>
              {!canJoinAsPlayer ? (
                <span className="text-xs text-destructive">
                  La place de joueur est déjà occupée.
                </span>
              ) : null}
            </div>
          </label>
          <label
            htmlFor={spectatorOptionId}
            className={cn(
              "flex items-start gap-3 rounded-md border px-3 py-3 text-sm transition-colors",
              selectedRole === "spectator"
                ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                : "border-border/70 bg-background",
              "cursor-pointer hover:border-primary/50 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
            )}
          >
            <input
              id={spectatorOptionId}
              type="radio"
              name={`${roleFieldId}-role`}
              value="spectator"
              checked={selectedRole === "spectator"}
              onChange={() => handleRoleChange("spectator")}
              className="mt-1 h-4 w-4 border-border/70 text-primary focus:ring-ring"
            />
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">Spectateur</span>
              <span className="text-xs text-muted-foreground">
                Observez la partie en direct sans interagir avec le plateau.
              </span>
            </div>
          </label>
        </div>
      </fieldset>

      {selectedRole === "player" ? (
        <>
          <div className="space-y-2">
            <label
              htmlFor="guest-nickname"
              className="text-sm font-medium text-foreground"
            >
              Votre pseudo
            </label>
            <input
              id="guest-nickname"
              type="text"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                if (localError) {
                  setLocalError(null);
                }
              }}
              onBlur={() => {
                if (!nickname.trim()) {
                  setLocalError(
                    "Un pseudo est nécessaire pour identifier chaque joueur.",
                  );
                }
              }}
              className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Invit mystère"
              maxLength={40}
              autoComplete="off"
              disabled={disabled || isSubmitting}
            />
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Ce pseudo sera visible par les autres participants afin que votre
              adversaire sache qui a rejoint la salle.
            </p>
            <p>
              Vous pourrez le modifier ultérieurement depuis votre tableau de
              bord.
            </p>
          </div>
        </>
      ) : (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Aucun pseudo n’est requis pour observer la partie.</p>
          <p>
            Fermez cette fenêtre pour suivre la partie en tant que spectateur.
          </p>
        </div>
      )}

      {localError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {localError}
        </div>
      ) : null}

      {selectedRole === "player" ? (
        <Button
          type="submit"
          disabled={disabled || isSubmitting || !canJoinAsPlayer}
        >
          <UsersIcon aria-hidden className="mr-2 size-4" />
          {isSubmitting ? "Connexion…" : `Rejoindre ${hostName}`}
        </Button>
      ) : (
        <DialogClose asChild>
          <Button type="button" variant="outline">
            <EyeIcon aria-hidden className="mr-2 size-4" />
            Observer la partie
          </Button>
        </DialogClose>
      )}
    </form>
  );
}
