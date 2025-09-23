"use client";

import { TimerIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ActiveTurnNoticeProps {
  readonly title: string;
  readonly description: string;
  readonly className?: string;
  readonly action?: ReactNode;
}

/**
 * Displays a prominent notice summarising whose turn is currently active.
 *
 * The component is optimised for live gameplay feedback: it announces updates
 * via `aria-live` so that assistive technologies and spectators immediately
 * perceive turn changes while keeping both boards visible on screen.
 */
export function ActiveTurnNotice({
  title,
  description,
  className,
  action = null,
}: ActiveTurnNoticeProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex flex-col gap-2 rounded-3xl border border-primary/40 bg-primary/10 px-4 py-3 text-primary shadow-sm backdrop-blur supports-[backdrop-filter]:bg-primary/15",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        <TimerIcon aria-hidden className="size-4" />
        <span>{title}</span>
      </div>
      <p className="text-xs text-primary/80 sm:text-sm">{description}</p>
      {action}
    </div>
  );
}
