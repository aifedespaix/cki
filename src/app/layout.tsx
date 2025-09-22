import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

import { Header } from "@/components/app/Header";
import { MobileNav } from "@/components/app/MobileNav";
import { ThemeProvider } from "@/components/app/ThemeProvider";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "@/components/app/theme";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const themeHydrationScript = `
if (typeof window !== 'undefined') {
  try {
    var storageKey = '${THEME_STORAGE_KEY}'
    var storedTheme = window.localStorage.getItem(storageKey)
    var theme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : null
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    var root = document.documentElement
    var opposite = theme === 'dark' ? 'light' : 'dark'
    root.classList.remove(opposite)
    root.classList.add(theme)
    root.style.colorScheme = theme
    root.dataset.theme = theme
  } catch (error) {
    console.warn('Theme hydration failed', error)
    document.documentElement.classList.add('${DEFAULT_THEME}')
  }
}
`;

export const metadata: Metadata = {
  title: "KeyS Companion",
  description:
    "Interface de commande pour créer, rejoindre et orchestrer vos parties KeyS en toute simplicité.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="scroll-smooth" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Theme hydration requires inline script before hydration
          dangerouslySetInnerHTML={{ __html: themeHydrationScript }}
        />
        <ThemeProvider>
          <Toaster />
          <a
            href="#main-content"
            className="focus-visible:ring-ring/60 focus-visible:ring-offset-background pointer-events-auto fixed left-1/2 top-3 z-50 -translate-x-1/2 -translate-y-16 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg transition-transform focus-visible:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Passer au contenu principal
          </a>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main
              id="main-content"
              className="mx-auto flex w-full max-w-6xl flex-1 min-h-0 flex-col px-4 pt-6 md:px-6"
            >
              <div className="page-shell flex flex-1 flex-col gap-8 pb-36 md:pb-12">
                {children}
              </div>
            </main>
            <footer className="border-t border-border/70 bg-background/95">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
                <p>
                  © {new Date().getFullYear()} KeyS. Jeu de déduction sécurisé
                  et accessible.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href="https://github.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Code source
                  </a>
                  <a
                    href="mailto:contact@keys.app"
                    className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Contact
                  </a>
                  <a
                    href="/create"
                    className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Créer une partie
                  </a>
                </div>
              </div>
            </footer>
          </div>
          <MobileNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
