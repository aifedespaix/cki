"use client";

import { CalendarCheckIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SessionPlannerSheetProps = {
  children: React.ReactNode;
};

function SessionPlannerSheet({ children }: SessionPlannerSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="flex max-w-md flex-col gap-0 p-0">
        <SheetHeader className="gap-1 border-b px-6 py-5">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <CalendarCheckIcon
              aria-hidden="true"
              className="size-5 text-primary"
            />
            Planifiez votre session
          </SheetTitle>
          <SheetDescription>
            Une feuille de route claire pour préparer vos parties à l’avance et
            partager les bonnes pratiques avec votre équipe.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
          <Tabs defaultValue="setup" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="setup">Configuration</TabsTrigger>
              <TabsTrigger value="players">Joueurs</TabsTrigger>
              <TabsTrigger value="safety">Sécurité</TabsTrigger>
            </TabsList>
            <TabsContent
              value="setup"
              className="space-y-3 text-sm leading-relaxed"
            >
              <p className="font-semibold">Avant de lancer la partie :</p>
              <ul className="space-y-2 pl-4 text-muted-foreground marker:text-primary">
                <li className="list-disc">
                  Sélectionnez une grille compatible avec le nombre de
                  participants.
                </li>
                <li className="list-disc">
                  Préparez les fiches personnages et validez les attributs
                  sensibles.
                </li>
                <li className="list-disc">
                  Activez les rappels automatiques pour ne jamais manquer une
                  manche.
                </li>
              </ul>
            </TabsContent>
            <TabsContent
              value="players"
              className="space-y-3 text-sm leading-relaxed"
            >
              <p className="font-semibold flex items-center gap-2">
                <UsersIcon aria-hidden="true" className="size-4" />
                Impliquez vos joueurs
              </p>
              <ul className="space-y-2 pl-4 text-muted-foreground marker:text-primary">
                <li className="list-disc">
                  Invitez par lien unique ou code et vérifiez les connexions
                  avant le départ.
                </li>
                <li className="list-disc">
                  Partagez un bref briefing vocal ou écrit pour rappeler les
                  règles.
                </li>
                <li className="list-disc">
                  Prévoyez un canal de secours (chat ou visio) en cas de
                  coupure.
                </li>
              </ul>
            </TabsContent>
            <TabsContent
              value="safety"
              className="space-y-3 text-sm leading-relaxed"
            >
              <p className="font-semibold flex items-center gap-2">
                <ShieldCheckIcon aria-hidden="true" className="size-4" />
                Sécurité et sérénité
              </p>
              <ul className="space-y-2 pl-4 text-muted-foreground marker:text-primary">
                <li className="list-disc">
                  Définissez un mot de passe de salle si le public est large.
                </li>
                <li className="list-disc">
                  Gardez un œil sur le tableau d’activité pour repérer les
                  anomalies.
                </li>
                <li className="list-disc">
                  Exportez les journaux de session localement pour vos audits
                  internes.
                </li>
              </ul>
              <Separator className="my-3" />
              <p className="text-muted-foreground">
                Toutes les données restent sur les appareils des joueurs. Aucun
                stockage serveur n’est effectué.
              </p>
            </TabsContent>
          </Tabs>
        </div>
        <SheetFooter className="border-t px-6 py-4">
          <Button asChild className="w-full">
            <Link href="/create">Ouvrir une salle maintenant</Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export { SessionPlannerSheet };
