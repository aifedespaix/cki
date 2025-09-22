"use client";

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  DropletsIcon,
  SparklesIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  Shalgemon,
  ShalgemonSortKey,
  SortDirection,
  SortState,
} from "@/lib/alchemy/types";
import { cn } from "@/lib/utils";

const DEFAULT_SORT: SortState = { key: "name", direction: "asc" };

const COLUMN_CONFIG: Array<{
  key: ShalgemonSortKey;
  label: string;
  widthClass: string;
  render: (shalgemon: Shalgemon) => ReactNode;
  getSortValue: (shalgemon: Shalgemon) => string | number;
}> = [
  {
    key: "name",
    label: "Shalgémon",
    widthClass: "w-[18rem]",
    render: (shalgemon) => (
      <div className="flex flex-col gap-1">
        <span className="font-medium leading-tight">{shalgemon.name}</span>
        <span className="text-xs text-muted-foreground">
          {shalgemon.signatureSkill}
        </span>
      </div>
    ),
    getSortValue: (shalgemon) => shalgemon.name,
  },
  {
    key: "element",
    label: "Élément",
    widthClass: "w-[10rem]",
    render: (shalgemon) => (
      <Badge variant="secondary" className="bg-secondary/70">
        {shalgemon.element}
      </Badge>
    ),
    getSortValue: (shalgemon) => shalgemon.element,
  },
  {
    key: "rarity",
    label: "Rareté",
    widthClass: "w-[9rem]",
    render: (shalgemon) => (
      <Badge
        className={cn(
          "capitalize",
          shalgemon.rarity === "Mythique"
            ? "bg-purple-500/80 text-white"
            : shalgemon.rarity === "Épique"
              ? "bg-amber-500/80 text-white"
              : shalgemon.rarity === "Rare"
                ? "bg-sky-500/80 text-white"
                : "bg-muted text-foreground",
        )}
      >
        {shalgemon.rarity}
      </Badge>
    ),
    getSortValue: (shalgemon) => shalgemon.rarity,
  },
  {
    key: "stability",
    label: "Stabilité",
    widthClass: "w-[8rem]",
    render: (shalgemon) => (
      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
        {shalgemon.stabilityIndex}%
      </span>
    ),
    getSortValue: (shalgemon) => shalgemon.stabilityIndex,
  },
  {
    key: "chromatic",
    label: "Spectre chromatique",
    widthClass: "w-[16rem]",
    render: (shalgemon) => (
      <div className="flex flex-wrap gap-1">
        {shalgemon.chromaticAffinity.map((tone) => (
          <Badge
            key={tone}
            variant="outline"
            className="border-primary/40 text-xs text-foreground"
          >
            <SparklesIcon aria-hidden="true" className="size-3" />
            {tone}
          </Badge>
        ))}
      </div>
    ),
    getSortValue: (shalgemon) => shalgemon.chromaticAffinity.join(" "),
  },
  {
    key: "odor",
    label: "Profil olfactif",
    widthClass: "w-[16rem]",
    render: (shalgemon) => (
      <div className="flex flex-wrap gap-1">
        {shalgemon.odorNotes.map((note) => (
          <Badge key={note} variant="outline" className="text-xs">
            <DropletsIcon aria-hidden="true" className="size-3" />
            {note}
          </Badge>
        ))}
      </div>
    ),
    getSortValue: (shalgemon) => shalgemon.odorNotes.join(" "),
  },
];

interface SortableShalgemonListProps {
  shalgemons: ReadonlyArray<Shalgemon>;
  selectedIds?: ReadonlyArray<string>;
  onSelectionChange?: (nextSelection: string[]) => void;
  selectionLimit?: number;
  onSelectionLimitExceeded?: () => void;
  initialSort?: SortState;
  emphasis?: "chromatic" | "odor";
  className?: string;
  "aria-label"?: string;
}

const EMPHASISED_BACKGROUND: Record<"chromatic" | "odor", string> = {
  chromatic: "bg-primary/5",
  odor: "bg-amber-500/10",
};

/**
 * Displays a sortable catalog of Shalgémon. It supports controlled multi
 * selection and highlights either the chromatic or olfactory column depending
 * on the use case (potion chromatique vs élixir d’odeur).
 */
function SortableShalgemonList({
  shalgemons,
  selectedIds = [],
  onSelectionChange,
  selectionLimit,
  onSelectionLimitExceeded,
  initialSort = DEFAULT_SORT,
  emphasis,
  className,
  "aria-label": ariaLabel,
}: SortableShalgemonListProps) {
  const [sortState, setSortState] = useState<SortState>(initialSort);

  const collator = useMemo(
    () => new Intl.Collator("fr", { sensitivity: "base" }),
    [],
  );

  const sortedShalgemons = useMemo(() => {
    const items = [...shalgemons];
    return items.sort((first, second) => {
      const column = COLUMN_CONFIG.find(
        (candidate) => candidate.key === sortState.key,
      );
      if (!column) {
        return 0;
      }
      const firstValue = column.getSortValue(first);
      const secondValue = column.getSortValue(second);

      let comparison = 0;
      if (typeof firstValue === "number" && typeof secondValue === "number") {
        comparison = firstValue - secondValue;
      } else {
        comparison = collator.compare(
          String(firstValue).toLowerCase(),
          String(secondValue).toLowerCase(),
        );
      }

      return sortState.direction === "asc" ? comparison : -comparison;
    });
  }, [collator, shalgemons, sortState]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleSort = useCallback((key: ShalgemonSortKey) => {
    setSortState((previous) => {
      if (previous.key === key) {
        const nextDirection: SortDirection =
          previous.direction === "asc" ? "desc" : "asc";
        return { key, direction: nextDirection };
      }
      const defaultDirection: SortDirection =
        key === "stability" ? "desc" : "asc";
      return { key, direction: defaultDirection };
    });
  }, []);

  const handleSelectionToggle = useCallback(
    (id: string) => {
      if (!onSelectionChange) {
        return;
      }
      const currentSelection = [...selectedIds];
      const isSelected = selectedSet.has(id);

      if (isSelected) {
        onSelectionChange(currentSelection.filter((value) => value !== id));
        return;
      }

      if (
        selectionLimit !== undefined &&
        currentSelection.length >= selectionLimit
      ) {
        onSelectionLimitExceeded?.();
        return;
      }

      onSelectionChange([...currentSelection, id]);
    },
    [
      onSelectionChange,
      selectedIds,
      selectedSet,
      selectionLimit,
      onSelectionLimitExceeded,
    ],
  );

  const renderSortIcon = (key: ShalgemonSortKey) => {
    if (sortState.key !== key) {
      return <ArrowUpDownIcon aria-hidden="true" className="ml-1 size-3.5" />;
    }
    return sortState.direction === "asc" ? (
      <ArrowUpIcon aria-hidden="true" className="ml-1 size-3.5" />
    ) : (
      <ArrowDownIcon aria-hidden="true" className="ml-1 size-3.5" />
    );
  };

  const emphasisedKey = emphasis ?? null;

  return (
    <Card className={className}>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[480px]">
          <table
            className="w-full min-w-[60rem] border-separate border-spacing-0 text-sm"
            aria-label={ariaLabel}
          >
            <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
              <tr>
                {COLUMN_CONFIG.map((column) => {
                  const isActive = sortState.key === column.key;
                  const ariaSort: React.AriaAttributes["aria-sort"] = isActive
                    ? sortState.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none";

                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={ariaSort}
                      className={cn(
                        "border-b border-border/70 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                        column.widthClass,
                      )}
                    >
                      <Button
                        type="button"
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => toggleSort(column.key)}
                        aria-label={`Trier par ${column.label}`}
                      >
                        {column.label}
                        {renderSortIcon(column.key)}
                      </Button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedShalgemons.map((shalgemon) => {
                const isSelected = selectedSet.has(shalgemon.id);
                return (
                  <tr
                    key={shalgemon.id}
                    className={cn(
                      "border-b border-border/60 transition-colors last:border-b-0",
                      isSelected && "bg-primary/5",
                    )}
                  >
                    {COLUMN_CONFIG.map((column) => {
                      const emphasisedClass =
                        emphasisedKey === column.key && emphasis
                          ? EMPHASISED_BACKGROUND[emphasis]
                          : undefined;
                      return (
                        <td
                          key={column.key}
                          className={cn("align-top px-3 py-3", emphasisedClass)}
                        >
                          {column.key === "name" && onSelectionChange ? (
                            <div className="flex items-start gap-2">
                              <input
                                id={`${shalgemon.id}-${column.key}`}
                                type="checkbox"
                                className="mt-1 size-4 rounded border-border/70 accent-primary"
                                checked={isSelected}
                                onChange={() =>
                                  handleSelectionToggle(shalgemon.id)
                                }
                                aria-label={`Sélectionner ${shalgemon.name}`}
                              />
                              <label
                                htmlFor={`${shalgemon.id}-${column.key}`}
                                className="cursor-pointer"
                              >
                                {column.render(shalgemon)}
                              </label>
                            </div>
                          ) : (
                            column.render(shalgemon)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export { SortableShalgemonList };
