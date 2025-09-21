import { ClipboardCheckIcon, RocketIcon, Settings2Icon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const presets = [
  {
    id: "classic",
    title: "Classique",
    description: "Grille 5x7 équilibrée, idéale pour une première partie.",
    details: [
      "24 personnages pré-configurés avec avatars inclus.",
      "Rotation automatique des questions pour dynamiser le jeu.",
      "Durée recommandée : 20 minutes.",
    ],
  },
  {
    id: "speed",
    title: "Rapide",
    description: "Sessions éclair de 10 minutes pour s’échauffer.",
    details: [
      "Grille 4x6 pour des parties nerveuses.",
      "Limite de 30 secondes par question pour maintenir le rythme.",
      "Score affiché en temps réel pour encourager la prise de risque.",
    ],
  },
  {
    id: "custom",
    title: "Personnalisé",
    description: "Construisez votre configuration de A à Z.",
    details: [
      "Importez vos avatars, thèmes et jeux de questions.",
      "Activez des règles maison : jokers, votes secrets, double chance.",
      "Exportez le preset pour le partager avec vos co-animateurs.",
    ],
  },
];

export default function CreatePage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <RocketIcon aria-hidden="true" className="size-4" />
          Configuration d’une nouvelle partie
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Créez votre salle KeyS
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Choisissez un preset adapté, ajustez les paramètres et partagez le
          code d’accès. Chaque réglage est pensé pour être modifié ensuite en
          direct pendant la partie.
        </p>
      </section>
      <Card className="border border-border/70">
        <CardHeader className="border-b border-border/70">
          <CardTitle className="text-xl">Sélection de preset</CardTitle>
          <CardDescription>
            Alternez entre nos configurations prêtes à l’emploi ou composez
            votre session sur mesure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 py-6">
          <Tabs defaultValue="classic" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              {presets.map((preset) => (
                <TabsTrigger key={preset.id} value={preset.id}>
                  {preset.title}
                </TabsTrigger>
              ))}
            </TabsList>
            {presets.map((preset) => (
              <TabsContent
                key={preset.id}
                value={preset.id}
                className="space-y-4 text-sm leading-relaxed text-muted-foreground"
              >
                <p className="font-medium text-foreground">
                  {preset.description}
                </p>
                <ul className="space-y-2 pl-4 marker:text-primary">
                  {preset.details.map((detail) => (
                    <li key={detail} className="list-disc">
                      {detail}
                    </li>
                  ))}
                </ul>
              </TabsContent>
            ))}
          </Tabs>
          <Separator className="bg-border/60" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Settings2Icon aria-hidden="true" className="size-4" />
                Paramètres avancés
              </div>
              <p>
                Définissez vos jokers, temporisations et contraintes de
                questions.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ClipboardCheckIcon aria-hidden="true" className="size-4" />
                Liste de contrôle
              </div>
              <p>
                Vérifiez la connexion de chaque joueur, le niveau audio et la
                caméra avant de lancer.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/70">
          <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Une fois le preset validé, le code de session apparaît
              immédiatement dans la barre du bas.
            </p>
            <Button asChild size="lg" className="sm:w-auto">
              <Link href="/join">Partager le code</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
