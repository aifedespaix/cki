"use client";

import { ImageIcon, LayoutGridIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  GridEditor,
  type GridEditorHandle,
} from "@/components/editor/GridEditor";
import { Button } from "@/components/ui/button";
import type { Grid } from "@/lib/game/types";
import {
  loadLatestNickname,
  persistHostPreparation,
  persistLatestNickname,
} from "@/lib/storage/session";

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

    try {
      persistHostPreparation({
        roomId,
        nickname: trimmedNickname,
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
    router.push(`/room/${roomId}`).catch((navigationError) => {
      console.error("Navigation vers la salle échouée.", navigationError);
      setStartError("La redirection vers la salle a échoué. Réessayez.");
      setIsStarting(false);
    });
  };

  return (
    <div className="flex flex-col gap-10">
      <section className="space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <SparklesIcon aria-hidden="true" className="size-4" />
          Configuration de la grille
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Créez votre plateau KeyS personnalisé
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Définissez vos cartes, importez des visuels et préparez la partie. Le
          lien d’invitation ne sera disponible qu’une fois la salle créée.
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
        <div className="space-y-2">
          <label
            htmlFor="nickname"
            className="text-sm font-medium text-foreground"
          >
            Votre pseudo (partagé avec les autres participants)
          </label>
          <input
            id="nickname"
            name="nickname"
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
              setStartError(null);
            }}
            onBlur={() => setNicknameTouched(true)}
            required
            maxLength={40}
            className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Hôte de la partie"
            autoComplete="off"
          />
          {nicknameTouched && !nickname.trim() ? (
            <p className="text-sm text-destructive">
              Un pseudo est requis pour identifier chaque participant.
            </p>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          Ce pseudo sera partagé avec les joueurs et spectateurs via le canal
          pair-à-pair. Vous pourrez inviter vos amis après avoir lancé la salle.
        </p>
      </section>

      <GridEditor ref={gridEditorRef} />

      <section className="space-y-3">
        {startError ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {startError}
          </div>
        ) : null}
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          onClick={handleStartGame}
          disabled={isStarting}
        >
          {isStarting ? "Création de la salle…" : "Démarrer la partie"}
        </Button>
      </section>
    </div>
  );
}
