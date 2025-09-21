"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ImageDownIcon,
  LinkIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Card } from "@/lib/game/types";

const MAX_FILE_SIZE_BYTES = 200 * 1024; // 200 kB keeps share URLs manageable.

const readableFileSize = (size: number): string => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
  }
  if (size >= 1024) {
    return `${Math.round(size / 1024)} Ko`;
  }
  return `${size} o`;
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Le fichier n’a pas pu être encodé."));
      }
    };
    reader.onerror = () => {
      reject(new Error("Impossible de lire le fichier local."));
    };
    reader.readAsDataURL(file);
  });

const ensureImageResponse = async (inputUrl: string): Promise<string> => {
  const url = inputUrl.trim();
  if (!url) {
    throw new Error("L’URL de l’image est vide.");
  }

  if (url.startsWith("data:")) {
    // Already an inline resource, accept it directly.
    return url;
  }

  let response: Response;
  try {
    response = await fetch(url, { mode: "cors" });
  } catch (_error) {
    throw new Error(
      "Impossible d’accéder à cette URL : le site bloque le chargement CORS ou la connexion a échoué.",
    );
  }
  if (!response.ok) {
    throw new Error(
      "L’image n’a pas pu être téléchargée (statut HTTP invalide).",
    );
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.startsWith("image/")) {
    throw new Error("Le contenu téléchargé n’est pas une image valide.");
  }

  return url;
};

interface CardEditorItemProps {
  card: Card;
  index: number;
  onChange: (card: Card) => void;
}

type ImageStatus =
  | { type: "idle" }
  | { type: "loading"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const DEFAULT_STATUS: ImageStatus = { type: "idle" };

/**
 * Form controls allowing the user to configure an individual card.
 * Handles both URL-based imports with CORS validation and inline file uploads.
 */
export function CardEditorItem({ card, index, onChange }: CardEditorItemProps) {
  const labelInputId = useId();
  const urlInputId = useId();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeRequestRef = useRef(0);

  const [urlInput, setUrlInput] = useState<string>(
    card.imageUrl && !card.imageUrl.startsWith("data:") ? card.imageUrl : "",
  );
  const [status, setStatus] = useState<ImageStatus>(DEFAULT_STATUS);

  useEffect(() => {
    if (card.imageUrl && !card.imageUrl.startsWith("data:")) {
      setUrlInput(card.imageUrl);
    }
  }, [card.imageUrl]);

  const updateStatus = (nextStatus: ImageStatus) => {
    setStatus(nextStatus);
  };

  const handleLabelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...card, label: event.target.value });
  };

  const handleUrlSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    if (!urlInput.trim()) {
      onChange({ ...card, imageUrl: undefined });
      updateStatus({ type: "success", message: "Image supprimée." });
      return;
    }

    try {
      updateStatus({
        type: "loading",
        message: "Vérification des en-têtes CORS…",
      });
      const validatedUrl = await ensureImageResponse(urlInput);
      if (activeRequestRef.current !== requestId) {
        return;
      }
      onChange({ ...card, imageUrl: validatedUrl });
      updateStatus({ type: "success", message: "Image externe validée." });
    } catch (error) {
      if (activeRequestRef.current !== requestId) {
        return;
      }
      updateStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible de valider cette URL d’image.",
      });
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const [file] = event.target.files ?? [];
    if (!file) {
      return;
    }

    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    if (!file.type.startsWith("image/")) {
      updateStatus({
        type: "error",
        message: "Seuls les fichiers images sont acceptés.",
      });
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      updateStatus({
        type: "error",
        message: `L’image est trop volumineuse (${readableFileSize(file.size)}). Limite : ${readableFileSize(MAX_FILE_SIZE_BYTES)}.`,
      });
      event.target.value = "";
      return;
    }

    try {
      updateStatus({ type: "loading", message: "Encodage de l’image locale…" });
      const dataUrl = await readFileAsDataUrl(file);
      if (activeRequestRef.current !== requestId) {
        return;
      }
      onChange({ ...card, imageUrl: dataUrl });
      setUrlInput("");
      updateStatus({
        type: "success",
        message: "Image locale importée (encodage inline).",
      });
    } catch (error) {
      if (activeRequestRef.current !== requestId) {
        return;
      }
      updateStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Le fichier n’a pas pu être importé.",
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClearImage = () => {
    activeRequestRef.current += 1;
    onChange({ ...card, imageUrl: undefined });
    setUrlInput("");
    updateStatus({ type: "success", message: "Image supprimée." });
  };

  const isInlineImage = Boolean(card.imageUrl?.startsWith("data:"));

  return (
    <div className="space-y-4 rounded-lg border border-border/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={labelInputId}
          className="text-sm font-medium text-foreground"
        >
          Carte {index + 1}
        </label>
        {card.imageUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearImage}
            className="h-8 px-2 text-xs"
          >
            <Trash2Icon aria-hidden="true" className="mr-1 size-3.5" />
            Retirer l’image
          </Button>
        ) : null}
      </div>
      <input
        id={labelInputId}
        type="text"
        value={card.label}
        onChange={handleLabelChange}
        className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={`Personnage ${index + 1}`}
      />
      <div className="space-y-2">
        <form className="space-y-2" onSubmit={handleUrlSubmit}>
          <label
            htmlFor={urlInputId}
            className="text-xs font-medium uppercase text-muted-foreground"
          >
            URL publique
          </label>
          <div className="flex gap-2">
            <input
              id={urlInputId}
              type="url"
              inputMode="url"
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              className="flex-1 rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="https://exemple.com/avatar.png"
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="shrink-0"
            >
              <LinkIcon aria-hidden="true" className="mr-2 size-4" />
              Valider
            </Button>
          </div>
        </form>
        <div className="space-y-2">
          <label
            htmlFor={fileInputId}
            className="text-xs font-medium uppercase text-muted-foreground"
          >
            Fichier local
          </label>
          <input
            id={fileInputId}
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
          />
          <p className="text-xs text-muted-foreground">
            Taille maximale recommandée :{" "}
            {readableFileSize(MAX_FILE_SIZE_BYTES)} pour préserver la longueur
            du lien de partage.
          </p>
        </div>
      </div>
      {status.type !== "idle" ? (
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
            status.type === "error"
              ? "border-destructive/60 bg-destructive/10 text-destructive"
              : status.type === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                : "border-border/60 bg-muted text-muted-foreground"
          }`}
        >
          {status.type === "loading" ? (
            <Loader2Icon aria-hidden="true" className="size-3.5 animate-spin" />
          ) : status.type === "success" ? (
            <CheckCircle2Icon
              aria-hidden="true"
              className="size-3.5 text-emerald-600"
            />
          ) : (
            <AlertCircleIcon
              aria-hidden="true"
              className="size-3.5 text-destructive"
            />
          )}
          <span>{status.message}</span>
        </div>
      ) : null}
      {card.imageUrl ? (
        <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ImageDownIcon aria-hidden="true" className="size-3.5" />
            <span>
              {isInlineImage
                ? "Image encodée dans le lien (data URI)."
                : "Image chargée depuis une URL accessible."}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
