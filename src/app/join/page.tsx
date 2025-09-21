"use client";

import {
  AlertCircleIcon,
  ArrowRightIcon,
  KeySquareIcon,
  LinkIcon,
  RefreshCcwIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { GridPreview } from "@/components/editor/GridPreview";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Grid } from "@/lib/game/types";
import {
  decodeGridFromToken,
  extractTokenFromInput,
  InvalidShareTokenError,
} from "@/lib/share/url";

const updateLocationHash = (token: string | null) => {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.hash = token ?? "";
  window.history.replaceState(null, "", url.toString());
};

export default function JoinPage() {
  const [inputValue, setInputValue] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const initialToken = window.location.hash.slice(1);
    if (initialToken) {
      setInputValue(initialToken);
      try {
        const payload = decodeGridFromToken(initialToken);
        setToken(initialToken);
        setGrid(payload.grid);
        setError(null);
      } catch (decodeError) {
        setError(
          decodeError instanceof Error
            ? decodeError.message
            : "Le fragment de l’URL ne correspond pas à un token valide.",
        );
      }
    }
  }, []);

  const gridSummary = useMemo(() => {
    if (!grid) {
      return null;
    }
    return {
      dimensions: `${grid.rows} × ${grid.columns}`,
      cards: grid.cards.length,
    };
  }, [grid]);

  const handleReset = () => {
    setGrid(null);
    setToken(null);
    setInputValue("");
    setError(null);
    updateLocationHash(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const maybeToken = extractTokenFromInput(inputValue);
    if (!maybeToken) {
      setError("Veuillez coller un lien ou un token valide.");
      setGrid(null);
      setToken(null);
      updateLocationHash(null);
      return;
    }

    try {
      const payload = decodeGridFromToken(maybeToken);
      setGrid(payload.grid);
      setToken(maybeToken);
      setInputValue(maybeToken);
      setError(null);
      updateLocationHash(maybeToken);
    } catch (decodeError) {
      setGrid(null);
      setToken(null);
      setError(
        decodeError instanceof InvalidShareTokenError
          ? decodeError.message
          : decodeError instanceof Error
            ? decodeError.message
            : "Impossible de décoder ce token.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <section className="space-y-5">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <KeySquareIcon aria-hidden="true" className="size-4" />
          Importer une grille partagée
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Rejoignez une partie avec un simple lien
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Collez le lien d’invitation ou le token communiqué par l’hôte. Le
          plateau est reconstruit localement sans échange de données
          personnelles.
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Coller un lien ou un token</CardTitle>
            <CardDescription>
              L’URL générée depuis la page « Créer » contient un fragment `#`
              avec les informations compressées.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label
                  htmlFor="invite-token"
                  className="text-sm font-medium text-foreground"
                >
                  Lien d’invitation ou token
                </label>
                <input
                  id="invite-token"
                  type="text"
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="https://exemple.com/join#TOKEN"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" className="flex-1 sm:flex-none">
                  <LinkIcon aria-hidden="true" className="mr-2 size-4" />
                  Décoder le lien
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="flex-1 sm:flex-none"
                >
                  <RefreshCcwIcon aria-hidden="true" className="mr-2 size-4" />
                  Réinitialiser
                </Button>
              </div>
            </form>
            {error ? (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircleIcon aria-hidden="true" className="mt-0.5 size-4" />
                <span>{error}</span>
              </div>
            ) : (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowRightIcon aria-hidden="true" className="size-4" />
                Le token n’est jamais envoyé à un serveur : tout est traité dans
                votre navigateur.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Aperçu de la grille importée</CardTitle>
            <CardDescription>
              Vérifiez les informations avant de lancer la partie.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {grid ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      Nom
                    </span>
                    <span className="text-foreground">{grid.name}</span>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      Identifiant
                    </span>
                    <span className="text-foreground">{grid.id}</span>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      Dimensions
                    </span>
                    <span className="text-foreground">
                      {gridSummary?.dimensions}
                    </span>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
                    <span className="block text-xs font-medium uppercase text-muted-foreground">
                      Cartes
                    </span>
                    <span className="text-foreground">
                      {gridSummary?.cards}
                    </span>
                  </div>
                </div>
                <GridPreview grid={grid} />
                {token ? (
                  <p className="text-xs text-muted-foreground">
                    Token actuel :{" "}
                    <span className="font-mono break-all">{token}</span>
                  </p>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-12 text-center text-sm text-muted-foreground">
                Aucune grille importée pour le moment. Collez un lien
                d’invitation pour afficher l’aperçu ici.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
