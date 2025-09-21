import {
  ArrowRightIcon,
  KeyboardIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const featureCards = [
  {
    title: "Expérience temps réel",
    description:
      "Synchronisation P2P instantanée avec PeerJS, même en mobilité. Les reconnects se font automatiquement.",
    icon: SparklesIcon,
  },
  {
    title: "Pensé pour le mobile",
    description:
      "Barre de navigation inférieure, boutons élargis et gestes simples pour jouer d’une seule main.",
    icon: SmartphoneIcon,
  },
  {
    title: "Accessibilité native",
    description:
      "Focus visibles, commandes clavier, contrastes élevés et lecture d’écran optimisée.",
    icon: KeyboardIcon,
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <section className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <SparklesIcon aria-hidden="true" className="size-4" />
            Votre salle de commande KeyS
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Orchestrez vos parties KeyS, du mobile au bureau
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Centralisez la création des salles, pilotez les joueurs et gardez un
            œil sur la partie en temps réel. L’interface s’adapte
            automatiquement entre thème clair et sombre.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="group">
              <Link href="/create">
                Démarrer une partie
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 transition-transform group-hover:translate-x-1"
                />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/join">Rejoindre avec un code</Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <ShieldCheckIcon
              aria-hidden="true"
              className="size-5 text-primary"
            />
            <span>100% P2P : aucune donnée n’est stockée côté serveur.</span>
          </div>
        </div>
        <Card className="border border-border/70 shadow-lg shadow-primary/10">
          <CardHeader className="border-b border-border/70">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-xl">Routine express</CardTitle>
              <CardDescription>
                Deux parcours optimisés pour lancer ou rejoindre une partie en
                moins d’une minute.
              </CardDescription>
            </div>
            <CardAction>
              <Button asChild size="sm" variant="ghost" className="gap-2">
                <Link href="/create">
                  Configurer
                  <ArrowRightIcon aria-hidden="true" className="size-4" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-5 py-6">
            <Tabs defaultValue="host" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="host">Animateur</TabsTrigger>
                <TabsTrigger value="guest">Invité</TabsTrigger>
              </TabsList>
              <TabsContent
                value="host"
                className="space-y-3 text-sm leading-relaxed text-muted-foreground"
              >
                <p>Préparez la salle avant l’arrivée de vos joueurs :</p>
                <ul className="space-y-2 pl-4 marker:text-primary">
                  <li className="list-disc">
                    Choisissez votre format de grille et vos personnages.
                  </li>
                  <li className="list-disc">
                    Activez l’audio d’accueil pour briefer les invités
                    automatiquement.
                  </li>
                  <li className="list-disc">
                    Envoyez le lien sécurisé ou le code de session en un clic.
                  </li>
                </ul>
              </TabsContent>
              <TabsContent
                value="guest"
                className="space-y-3 text-sm leading-relaxed text-muted-foreground"
              >
                <p>Une expérience fluide pour les participants :</p>
                <ul className="space-y-2 pl-4 marker:text-primary">
                  <li className="list-disc">
                    Saisie rapide du code ou ouverture directe via un lien
                    partagé.
                  </li>
                  <li className="list-disc">
                    Compatibilité mobile et desktop avec synchronisation
                    instantanée.
                  </li>
                  <li className="list-disc">
                    Aide contextuelle et rappels des règles à portée de main.
                  </li>
                </ul>
              </TabsContent>
            </Tabs>
            <Separator className="bg-border/60" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">
                  Progrès des joueurs
                </div>
                <p>
                  Visualisez qui a répondu à quelles questions en temps réel.
                </p>
              </div>
              <div className="rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">
                  Journal de session
                </div>
                <p>
                  Consultez l’historique des échanges pour arbitrer sans stress.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
      <Separator className="bg-border/60" />
      <section className="grid gap-6 md:grid-cols-3">
        {featureCards.map((feature) => (
          <Card key={feature.title} className="h-full border border-border/60">
            <CardHeader className="flex flex-row items-start justify-between border-b border-border/60">
              <div className="space-y-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <feature.icon
                    aria-hidden="true"
                    className="size-5 text-primary"
                  />
                  {feature.title}
                </CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </div>
              <UsersIcon
                aria-hidden="true"
                className="size-5 text-muted-foreground"
              />
            </CardHeader>
            <CardContent className="py-6 text-sm text-muted-foreground">
              <p>
                Les actions sont regroupées en onglets et les retours visuels
                garantissent une compréhension immédiate, quel que soit
                l’appareil utilisé.
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
