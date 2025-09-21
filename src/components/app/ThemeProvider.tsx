"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

import { DEFAULT_THEME, THEME_STORAGE_KEY, type ThemeName } from "./theme";

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (nextTheme: ThemeName) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type ThemePreferenceSource = "system" | "user";

function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  const oppositeTheme = theme === "dark" ? "light" : "dark";
  root.classList.remove(oppositeTheme);
  root.classList.add(theme);
  root.style.colorScheme = theme;
  root.dataset.theme = theme;
}

function readStoredTheme(): ThemeName | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") {
      return value;
    }
    return null;
  } catch (error) {
    console.error("Unable to read the stored theme", error);
    return null;
  }
}

function getSystemTheme(): ThemeName {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);
  const [preferenceSource, setPreferenceSource] =
    useState<ThemePreferenceSource>("system");
  const hasDisplayedToastRef = useRef(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedTheme = readStoredTheme();
    if (storedTheme) {
      setPreferenceSource("user");
      setThemeState(storedTheme);
      return;
    }
    setThemeState(getSystemTheme());
  }, []);

  useEffect(() => {
    if (preferenceSource !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handlePreferenceChange = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handlePreferenceChange);
    return () =>
      mediaQuery.removeEventListener("change", handlePreferenceChange);
  }, [preferenceSource]);

  useEffect(() => {
    applyTheme(theme);

    try {
      if (preferenceSource === "user") {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      } else {
        window.localStorage.removeItem(THEME_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Unable to persist the theme", error);
    }

    if (!hasDisplayedToastRef.current) {
      hasDisplayedToastRef.current = true;
      return;
    }

    if (preferenceSource === "user") {
      toast({
        title: theme === "dark" ? "Mode sombre activé" : "Mode clair activé",
        description:
          theme === "dark"
            ? "Les contrastes renforcés facilitent les sessions nocturnes."
            : "La luminosité est ajustée pour les environnements clairs.",
        duration: 2400,
      });
    }
  }, [theme, preferenceSource, toast]);

  const setTheme = useCallback((nextTheme: ThemeName) => {
    setPreferenceSource("user");
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceSource("user");
    setThemeState((currentTheme) =>
      currentTheme === "dark" ? "light" : "dark",
    );
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

type ThemeToggleProps = {
  className?: string;
};

function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const label = isDark ? "Activer le thème clair" : "Activer le thème sombre";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={isDark}
      onClick={toggleTheme}
      className={cn("relative", className)}
    >
      <SunIcon
        aria-hidden="true"
        className={cn(
          "size-5 rotate-0 scale-100 transition-all duration-300",
          isDark && "-rotate-90 scale-0",
        )}
      />
      <MoonIcon
        aria-hidden="true"
        className={cn(
          "size-5 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 scale-0 transition-all duration-300",
          isDark && "rotate-0 scale-100",
        )}
      />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

export { ThemeProvider, ThemeToggle, useTheme };
