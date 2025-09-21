"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarCheckIcon,
  HelpCircleIcon,
  HomeIcon,
  PlusCircleIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { QuickHelpDialog } from "./QuickHelpDialog";
import { SessionPlannerSheet } from "./SessionPlannerSheet";
import { ThemeToggle, useTheme } from "./ThemeProvider";

export type NavigationItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

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

function Header() {
  const pathname = usePathname();
  const { theme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <Link
          href="/"
          aria-label="Retour à l’accueil KeyS"
          className="group flex items-center gap-2 rounded-md px-2 py-1 font-semibold text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="relative flex items-center justify-center rounded-md bg-primary/10 p-1 transition-transform group-hover:scale-105">
            <SparklesIcon aria-hidden="true" className="size-5 text-primary" />
          </span>
          <span className="hidden sm:inline">KeyS</span>
          <span className="text-sm font-medium text-muted-foreground sm:hidden">
            KeyS
          </span>
        </Link>
        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Navigation principale"
        >
          {navigationItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));

            return (
              <Button
                key={item.href}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                asChild
                className={cn("px-3", isActive && "shadow-sm")}
              >
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className="flex items-center gap-2"
                >
                  <item.icon aria-hidden="true" className="size-4" />
                  <span>{item.label}</span>
                </Link>
              </Button>
            );
          })}
        </nav>
        <div className="flex items-center gap-1.5">
          <SessionPlannerSheet>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="hidden items-center gap-2 md:inline-flex"
            >
              <CalendarCheckIcon aria-hidden="true" className="size-4" />
              Préparer
            </Button>
          </SessionPlannerSheet>
          <QuickHelpDialog currentTheme={theme}>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="hidden items-center gap-2 md:inline-flex"
            >
              <HelpCircleIcon aria-hidden="true" className="size-4" />
              Aide
            </Button>
          </QuickHelpDialog>
          <ThemeToggle className="ml-0" />
        </div>
      </div>
    </header>
  );
}

export { Header };
