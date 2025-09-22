"use client";

import { CopyIcon, LogOutIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

import { useHeaderActions } from "./HeaderActionsContext";
import { ThemeToggle } from "./ThemeProvider";

function Header() {
  const { actions } = useHeaderActions();
  const inviteAction = actions.invite;
  const leaveAction = actions.leave;

  const inviteStatus = inviteAction?.status ?? "idle";

  const inviteLabel = (() => {
    if (!inviteAction) {
      return null;
    }
    switch (inviteStatus) {
      case "pending":
        return inviteAction.pendingLabel ?? "Copie en cours…";
      case "copied":
        return inviteAction.successLabel ?? "Lien copié";
      case "error":
        return inviteAction.errorLabel ?? "Réessayer";
      default:
        return inviteAction.label;
    }
  })();

  const inviteAriaLabel =
    inviteAction?.ariaLabel ?? "Copier le lien d’invitation";
  const InviteIcon = inviteAction?.icon ?? CopyIcon;
  const isInviteDisabled =
    Boolean(inviteAction?.disabled) || inviteStatus === "pending";

  const leaveLabel = leaveAction?.label ?? "Quitter la salle";
  const leaveAriaLabel =
    leaveAction?.ariaLabel ?? "Quitter la salle et revenir à l’accueil";
  const LeaveIcon = leaveAction?.icon ?? LogOutIcon;
  const isLeaveDisabled = Boolean(leaveAction?.disabled);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link
          href="/"
          aria-label="Retour à l’accueil C ki ? Companion"
          className="group flex items-center gap-2 rounded-md px-2 py-1 font-semibold text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="relative flex items-center justify-center rounded-md bg-primary/10 p-1 transition-transform group-hover:scale-105">
            <SparklesIcon aria-hidden="true" className="size-5 text-primary" />
          </span>
          <span className="hidden sm:inline">C ki ? Companion</span>
          <span className="text-sm font-medium text-muted-foreground sm:hidden">
            C ki ?
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-end gap-1.5">
          {inviteAction && inviteLabel ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2 px-2.5 text-sm sm:px-3"
              aria-label={inviteAriaLabel}
              disabled={isInviteDisabled}
              onClick={() => {
                void inviteAction.onActivate();
              }}
            >
              <InviteIcon aria-hidden="true" className="size-4" />
              <span>{inviteLabel}</span>
            </Button>
          ) : null}
          {leaveAction ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="gap-2 px-2.5 text-sm sm:px-3"
              aria-label={leaveAriaLabel}
              disabled={isLeaveDisabled}
              onClick={() => {
                void leaveAction.onActivate();
              }}
            >
              <LeaveIcon aria-hidden="true" className="size-4" />
              <span>{leaveLabel}</span>
            </Button>
          ) : null}
          <ThemeToggle className="ml-0" />
        </div>
      </div>
      {inviteAction?.feedbackMessage ? (
        <p
          className="sr-only"
          aria-live={inviteAction.feedbackTone ?? "polite"}
        >
          {inviteAction.feedbackMessage}
        </p>
      ) : null}
    </header>
  );
}

export { Header };
