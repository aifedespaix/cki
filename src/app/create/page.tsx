import { ImageIcon, LayoutGridIcon, SparklesIcon } from "lucide-react";

import { GridEditor } from "@/components/editor/GridEditor";

export default function CreatePage() {
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
          Définissez vos cartes, importez des visuels et générez un lien
          sécurisé à partager avec votre invité. L’URL contient toutes les
          informations pour reconstruire la partie en local.
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
      <GridEditor />
    </div>
  );
}
