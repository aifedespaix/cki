"use client";

import { HelpCircleIcon, KeyboardIcon, SmartphoneIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { ThemeName } from "./theme";

const CTA_LABEL_BY_THEME: Record<ThemeName, string> = {
  light: "Basculer en sombre pour les nuits",
  dark: "Basculer en clair pour la journée",
};

type QuickHelpDialogProps = {
  children: React.ReactNode;
  currentTheme: ThemeName;
};

function QuickHelpDialog({ children, currentTheme }: QuickHelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg space-y-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left text-lg">
            <HelpCircleIcon
              aria-hidden="true"
              className="size-5 text-primary"
            />
            Besoin d’un rappel ?
          </DialogTitle>
          <DialogDescription className="text-left">
            Retrouvez les étapes clés pour lancer une partie sans stress et un
            rappel des raccourcis accessibles au clavier comme sur mobile.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="hosts" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="hosts">
              <span className="flex items-center gap-1">
                <KeyboardIcon aria-hidden="true" className="size-4" />
                Animateur
              </span>
            </TabsTrigger>
            <TabsTrigger value="guests">
              <span className="flex items-center gap-1">
                <SmartphoneIcon aria-hidden="true" className="size-4" />
                Invité
              </span>
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="hosts"
            className="space-y-3 text-sm leading-relaxed text-left"
          >
            <p className="font-semibold">Organisez votre salle :</p>
            <ul className="space-y-2 pl-4 text-muted-foreground marker:text-primary">
              <li className="list-disc">
                Créez une session depuis l’onglet « Créer » et définissez vos
                règles.
              </li>
              <li className="list-disc">
                Partagez le code généré ou envoyez le lien sécurisé à vos
                invités.
              </li>
              <li className="list-disc">
                Adaptez votre grille en direct&nbsp;: couleur, taille et avatars
                restent modifiables.
              </li>
            </ul>
            <Separator className="my-2" />
            <p className="text-muted-foreground">
              Astuce&nbsp;: {CTA_LABEL_BY_THEME[currentTheme]}. Le basculement
              est instantané et garde vos préférences en mémoire.
            </p>
          </TabsContent>
          <TabsContent
            value="guests"
            className="space-y-3 text-sm leading-relaxed text-left"
          >
            <p className="font-semibold">Rejoignez en toute simplicité :</p>
            <ul className="space-y-2 pl-4 text-muted-foreground marker:text-primary">
              <li className="list-disc">
                Ouvrez l’onglet « Rejoindre » et saisissez le code transmis.
              </li>
              <li className="list-disc">
                Gardez votre micro coupé tant que la partie n’a pas commencé.
              </li>
              <li className="list-disc">
                Ajoutez l’application à votre écran d’accueil pour un accès
                instantané.
              </li>
            </ul>
            <Separator className="my-2" />
            <p className="text-muted-foreground">
              La navigation est 100% accessible au clavier et les boutons
              possèdent une large zone tactile sur mobile.
            </p>
          </TabsContent>
        </Tabs>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/join">Tester avec un code démo</Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/create">Lancer une nouvelle partie</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { QuickHelpDialog };
