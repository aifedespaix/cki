"use client";

import { CalendarCheckIcon, HelpCircleIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { navigationItems } from "./navigation";
import { QuickHelpDialog } from "./QuickHelpDialog";
import { SessionPlannerSheet } from "./SessionPlannerSheet";
import { ThemeToggle, useTheme } from "./ThemeProvider";

function MobileNav() {
  const pathname = usePathname();
  const { theme } = useTheme();

  const [homeItem, createItem, joinItem] = navigationItems;
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const navigationElement = navRef.current;

    if (!navigationElement || typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;

    const updateHeight = () => {
      const { height } = navigationElement.getBoundingClientRect();
      const heightValue = Number.isFinite(height) ? `${height}px` : "0px";
      root.style.setProperty("--mobile-nav-height", heightValue);
    };

    updateHeight();

    let resizeObserver: ResizeObserver | null = null;
    let didAttachWindowListener = false;

    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });
      resizeObserver.observe(navigationElement);
    } else if (typeof window !== "undefined") {
      window.addEventListener("resize", updateHeight);
      didAttachWindowListener = true;
    }

    return () => {
      root.style.setProperty("--mobile-nav-height", "0px");

      if (resizeObserver) {
        resizeObserver.disconnect();
        return;
      }

      if (didAttachWindowListener && typeof window !== "undefined") {
        window.removeEventListener("resize", updateHeight);
      }
    };
  }, []);

  return (
    <div
      data-mobile-nav="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden"
    >
      <nav
        ref={navRef}
        className="pointer-events-auto mx-auto w-full max-w-6xl border-t border-border/70 bg-background/95 px-1 pb-[calc(env(safe-area-inset-bottom)_+_0.75rem)] pt-2 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.35)] backdrop-blur"
      >
        <div className="grid grid-cols-5 items-end gap-1">
          {[homeItem, createItem].map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));

            return (
              <Button
                key={item.href}
                asChild
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium transition-all",
                  isActive && "shadow-sm",
                )}
              >
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon aria-hidden="true" className="mx-auto size-5" />
                  <span className="text-[11px] leading-tight">
                    {item.label}
                  </span>
                </Link>
              </Button>
            );
          })}
          <SessionPlannerSheet>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="flex h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-semibold"
            >
              <CalendarCheckIcon
                aria-hidden="true"
                className="mx-auto size-5"
              />
              <span className="text-[11px] leading-tight">Planifier</span>
            </Button>
          </SessionPlannerSheet>
          {[joinItem].map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));

            return (
              <Button
                key={item.href}
                asChild
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium transition-all",
                  isActive && "shadow-sm",
                )}
              >
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon aria-hidden="true" className="mx-auto size-5" />
                  <span className="text-[11px] leading-tight">
                    {item.label}
                  </span>
                </Link>
              </Button>
            );
          })}
          <QuickHelpDialog currentTheme={theme}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex h-14 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium"
            >
              <HelpCircleIcon aria-hidden="true" className="mx-auto size-5" />
              <span className="text-[11px] leading-tight">Aide</span>
            </Button>
          </QuickHelpDialog>
        </div>
        <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
          <span>Thème</span>
          <ThemeToggle />
        </div>
      </nav>
    </div>
  );
}

export { MobileNav };
