import {
  ArrowRightIcon,
  KeySquareIcon,
  PlusCircleIcon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const actions = [
  {
    id: "create",
    title: "Créer une partie",
    description:
      "Préparez la grille, ajoutez vos personnages et générez instantanément le lien ou le code à partager.",
    helper: "Idéal pour l’hôte : tout est prêt avant d’inviter les joueurs.",
    href: "/create",
    buttonLabel: "Ouvrir l’espace de création",
    icon: PlusCircleIcon,
  },
  {
    id: "join",
    title: "Rejoindre une partie",
    description:
      "Entrez un code reçu ou ouvrez le lien d’invitation pour retrouver la grille partagée sur votre appareil.",
    helper:
      "Pensé pour les invités : zéro compte, zéro configuration supplémentaire.",
    href: "/join",
    buttonLabel: "Accéder au formulaire de connexion",
    icon: KeySquareIcon,
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col gap-10 py-10">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 text-center sm:items-start sm:text-left">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
          <ShieldCheckIcon aria-hidden="true" className="size-4" />
          Interface officielle « C ki ? »
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Choisissez simplement : créer une partie ou rejoindre un hôte
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Cette page va à l’essentiel. Sélectionnez l’action adaptée à votre
          rôle, puis laissez-vous guider étape par étape. Les boutons sont
          grands, contrastés et accessibles depuis mobile ou desktop.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {actions.map((action) => (
          <Card
            key={action.id}
            className="flex h-full flex-col border border-border/70"
          >
            <CardHeader className="space-y-3">
              <CardTitle className="flex items-center gap-2 text-xl">
                <action.icon
                  aria-hidden="true"
                  className="size-5 text-primary"
                />
                {action.title}
              </CardTitle>
              <CardDescription>{action.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto flex flex-col gap-6">
              <p className="text-sm text-muted-foreground">{action.helper}</p>
              <Button
                asChild
                size="lg"
                wrapping="wrap"
                className="group w-full justify-between gap-3 text-left"
                aria-label={`${action.title} : ${action.buttonLabel}`}
              >
                <Link href={action.href}>
                  <span className="min-w-0 flex-1 text-left">
                    {action.buttonLabel}
                  </span>
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>

      <p className="flex items-start justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
        <ShieldCheckIcon
          aria-hidden="true"
          className="mt-0.5 size-4 text-primary"
        />
        Aucun compte requis et rien n’est stocké : tout se passe directement
        entre les participants.
      </p>
    </div>
  );
}
