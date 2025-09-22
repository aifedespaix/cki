import { BeakerIcon, FlaskConicalIcon } from "lucide-react";

import { ChromaticPotionConfigurator } from "@/components/alchemy/ChromaticPotionConfigurator";
import { OdorElixirConfigurator } from "@/components/alchemy/OdorElixirConfigurator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AlchemyLabPage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <FlaskConicalIcon aria-hidden="true" className="size-4" />
          Laboratoire d’alchimie
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Harmonisez élixirs et potions
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg">
          Accédez aux référentiels utilisés par l’équipe : l’élixir d’odeur sert
          de base aromatique tandis que la potion chromatique permet de calibrer
          la palette lumineuse. Les listes de Shalgémon sont triables pour
          faciliter la comparaison.
        </p>
      </section>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/70">
          <CardTitle className="flex items-center gap-2 text-xl">
            <BeakerIcon aria-hidden="true" className="size-5 text-primary" />
            Protocoles disponibles
          </CardTitle>
          <CardDescription>
            Naviguez entre les recettes pour consulter les recommandations et
            sélectionner les Shalgémon adaptés à chaque effet recherché.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="odor" className="space-y-6 p-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="odor">Élixir d’odeur</TabsTrigger>
              <TabsTrigger value="chromatic">Potion chromatique</TabsTrigger>
            </TabsList>
            <TabsContent value="odor" className="space-y-6">
              <OdorElixirConfigurator />
            </TabsContent>
            <TabsContent value="chromatic" className="space-y-6">
              <ChromaticPotionConfigurator />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Separator className="bg-border/60" />

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border border-border/60 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">
              Pourquoi trier les Shalgémon ?
            </CardTitle>
            <CardDescription>
              Le tri dynamique vous aide à équilibrer vos mixtures selon la
              stabilité, la rareté ou les notes aromatiques dominantes.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border border-border/60 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">Bonnes pratiques</CardTitle>
            <CardDescription>
              Consignez vos combinaisons réussies pour accélérer les futures
              sessions et partager les recettes avec vos coéquipiers.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </div>
  );
}
