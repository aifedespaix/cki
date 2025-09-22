import type { LucideIcon } from "lucide-react";
import { HomeIcon, PlusCircleIcon, UsersIcon } from "lucide-react";

export interface NavigationItem {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: LucideIcon;
}

export const navigationItems: NavigationItem[] = [
  {
    href: "/",
    label: "Accueil",
    description: "Tableau de bord général",
    icon: HomeIcon,
  },
  {
    href: "/create",
    label: "Créer",
    description: "Configurer une nouvelle partie",
    icon: PlusCircleIcon,
  },
  {
    href: "/join",
    label: "Rejoindre",
    description: "Entrer dans une partie existante",
    icon: UsersIcon,
  },
];
