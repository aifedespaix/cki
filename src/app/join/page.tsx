import {
  KeySquareIcon,
  LinkIcon,
  QrCodeIcon,
  ShieldAlertIcon,
} from "lucide-react";
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

const joinMethods = [
  {
    id: "code",
    icon: KeySquareIcon,
    title: "Entrer un code",
    description: "Idéal en visio ou lors d’un partage oral rapide.",
    steps: [
      "Saisissez le code unique à 6 caractères transmis par l’animateur.",
      "Vérifiez que l’icône d’état passe au vert avant de continuer.",
      "Le plateau se synchronise automatiquement avec la partie en cours.",
    ],
  },
  {
    id: "link",
    icon: LinkIcon,
    title: "Suivre un lien",
    description: "Pratique pour un partage par message ou e-mail.",
    steps: [
      "Cliquez sur le lien reçu : la salle s’ouvre directement dans l’application.",
      "Confirmez votre pseudo et choisissez votre avatar.",
      "Vous arrivez dans la salle d’attente en moins de 5 secondes.",
    ],
  },
  {
    id: "qr",
    icon: QrCodeIcon,
    title: "Scanner un QR code",
    description: "Idéal pour une installation sur écran géant ou tablette.",
    steps: [
      "Scannez le QR code affiché par l’animateur ou sur un flyer.",
      "Autorisez la caméra si nécessaire, puis confirmez l’accès.",
      "Le mode plein écran se déclenche automatiquement sur mobile.",
    ],
  },
];

export default function JoinPage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <KeySquareIcon aria-hidden="true" className="size-4" />
          Rejoindre une partie en cours
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Rejoignez vos coéquipiers
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Trois méthodes, un objectif : entrer dans la salle en quelques
          secondes. Utilisez l’option la plus simple selon votre contexte.
        </p>
      </section>
      <Card className="border border-border/70">
        <CardHeader className="border-b border-border/70">
          <CardTitle className="text-xl">Méthode d’accès</CardTitle>
          <CardDescription>
            Sélectionnez le mode qui correspond à la façon dont vous avez reçu
            l’invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 py-6">
          <Tabs defaultValue="code" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              {joinMethods.map((method) => (
                <TabsTrigger key={method.id} value={method.id}>
                  {method.title}
                </TabsTrigger>
              ))}
            </TabsList>
            {joinMethods.map((method) => (
              <TabsContent
                key={method.id}
                value={method.id}
                className="space-y-4 text-sm leading-relaxed text-muted-foreground"
              >
                <div className="flex items-center gap-2 text-foreground">
                  <method.icon
                    aria-hidden="true"
                    className="size-5 text-primary"
                  />
                  <p className="font-medium">{method.description}</p>
                </div>
                <ul className="space-y-2 pl-4 marker:text-primary">
                  {method.steps.map((step) => (
                    <li key={step} className="list-disc">
                      {step}
                    </li>
                  ))}
                </ul>
              </TabsContent>
            ))}
          </Tabs>
          <Separator className="bg-border/60" />
          <div className="rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <ShieldAlertIcon aria-hidden="true" className="size-4" />
              Sécurité
            </div>
            <p>
              Ne partagez jamais votre code KeyS publiquement. Si vous suspectez
              une intrusion, retournez sur la page « Créer » pour régénérer une
              nouvelle session en un clic.
            </p>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/70">
          <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Vous avez reçu un autre lien ? Ouvrez-le directement, cette page
              s’adapte automatiquement.
            </p>
            <Button asChild size="lg" className="sm:w-auto">
              <Link href="/create">Créer votre propre partie</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
