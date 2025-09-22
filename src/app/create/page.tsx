"use client";

import { ImageIcon, LayoutGridIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  GridEditor,
  type GridEditorHandle,
} from "@/components/editor/GridEditor";
import { NicknameInput } from "@/components/NicknameInput";
import { Button } from "@/components/ui/button";
import type { Grid } from "@/lib/game/types";
import {
  loadLatestNickname,
  persistHostPreparation,
  persistLatestNickname,
} from "@/lib/storage/session";
import { createRandomId } from "@/lib/utils";

const createRoomId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `room-${Math.random().toString(36).slice(2, 10)}`;
};

export default function CreatePage() {
  const router = useRouter();
  const gridEditorRef = useRef<GridEditorHandle | null>(null);
  const [nickname, setNickname] = useState("");
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const stored = loadLatestNickname();
    if (stored) {
      setNickname(stored);
    }
  }, []);

  useEffect(() => {
    persistLatestNickname(nickname);
  }, [nickname]);

  const handleStartGame = () => {
    setNicknameTouched(true);
    setStartError(null);

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setStartError("Veuillez renseigner un pseudo pour démarrer la partie.");
      return;
    }

    const editor = gridEditorRef.current;
    if (!editor) {
      setStartError("La grille n’est pas prête. Veuillez réessayer.");
      return;
    }

    let grid: Grid;
    try {
      grid = editor.commitGrid();
    } catch (error) {
      setStartError(
        error instanceof Error
          ? error.message
          : "Impossible de préparer le plateau. Recommencez.",
      );
      return;
    }

    const assets = editor.getAssets();
    const roomId = createRoomId();
    const hostId = createRandomId("player");

    try {
      persistHostPreparation({
        roomId,
        nickname: trimmedNickname,
        hostId,
        grid,
        assets,
      });
    } catch (error) {
      setStartError(
        error instanceof Error
          ? error.message
          : "Impossible d’enregistrer la préparation de partie.",
      );
      return;
    }

    setIsStarting(true);

    try {
      router.push(`/room/${roomId}`);
    } catch (navigationError) {
      console.error("Navigation vers la salle échouée.", navigationError);
      setStartError("La redirection vers la salle a échoué. Réessayez.");
      setIsStarting(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pb-24 pt-10 sm:px-6 sm:pb-16 lg:px-8">
          <section className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <SparklesIcon aria-hidden="true" className="size-4" />
              Configuration de la grille
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Créez votre plateau personnalisé pour « C ki ? »
            </h1>
            <p className="text-base text-muted-foreground sm:text-lg">
              Personnalisez vos cartes depuis l’aperçu interactif puis partagez
              votre salle en un instant. Le lien d’invitation s’affichera une
              fois la préparation terminée.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <LayoutGridIcon
                  aria-hidden="true"
                  className="size-4 text-primary"
                />
                Dimensions dynamiques (2 à 8 cases par côté)
              </div>
              <div className="flex items-center gap-2">
                <ImageIcon aria-hidden="true" className="size-4 text-primary" />
                Images locales ou via URL publique
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <NicknameInput
              inputId="nickname"
              value={nickname}
              onValueChange={(nextValue) => {
                setNickname(nextValue);
                setStartError(null);
              }}
              onBlur={() => setNicknameTouched(true)}
              showValidationFeedback={nicknameTouched}
              description="Ce pseudo sera visible par les joueurs et les spectateurs pendant la partie. Vous pourrez inviter vos amis après avoir lancé la salle."
              autoComplete="nickname"
            />
          </section>

          <GridEditor ref={gridEditorRef} />
        </div>
      </main>

      <div className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 pt-4 shadow-[0_-12px_24px_-20px_rgba(15,23,42,0.45)] backdrop-blur mobile-nav-offset [--mobile-nav-offset-extra:1rem] supports-[backdrop-filter]:bg-background/80 sm:relative sm:border-t-0 sm:bg-transparent sm:px-6 sm:pt-8 sm:[--mobile-nav-offset-extra:2rem] sm:shadow-none sm:backdrop-blur-none lg:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          {startError ? (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:flex-1"
            >
              {startError}
            </div>
          ) : null}
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto sm:min-w-[14rem]"
            onClick={handleStartGame}
            disabled={isStarting}
          >
            {isStarting ? "Création de la salle…" : "Démarrer la partie"}
          </Button>
        </div>
      </div>
    </div>
  );
}
