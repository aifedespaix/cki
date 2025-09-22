"use client";

import type { LucideIcon } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Possible states for an invite-link action rendered in the application header.
 */
export type HeaderInviteActionStatus = "idle" | "pending" | "copied" | "error";

/**
 * Configuration for an action that allows players to copy the current room invite link.
 */
export interface HeaderInviteAction {
  /** Icon rendered before the label. Defaults to a copy icon in the header. */
  readonly icon?: LucideIcon;
  /** Accessible label announced to assistive technologies. */
  readonly ariaLabel?: string;
  /** Visual label displayed in the header button when no specific state is active. */
  readonly label: string;
  /** Label displayed while the action is resolving. */
  readonly pendingLabel?: string;
  /** Label displayed when the invite link has been copied successfully. */
  readonly successLabel?: string;
  /** Label displayed when the copy operation failed. */
  readonly errorLabel?: string;
  /** Current status of the action. */
  readonly status?: HeaderInviteActionStatus;
  /** Whether the control should be disabled. */
  readonly disabled?: boolean;
  /** Optional feedback message exposed through an aria-live region. */
  readonly feedbackMessage?: string | null;
  /** Tone used for the aria-live region. Defaults to "polite". */
  readonly feedbackTone?: "polite" | "assertive";
  /** Function called when the action is triggered. */
  readonly onActivate: () => void | Promise<void>;
}

/**
 * Configuration for a destructive action that lets a player leave the current room.
 */
export interface HeaderLeaveAction {
  /** Icon rendered before the label. Defaults to a logout icon in the header. */
  readonly icon?: LucideIcon;
  /** Accessible label for assistive technologies. */
  readonly ariaLabel?: string;
  /** Text content displayed in the button. */
  readonly label: string;
  /** Whether the button should be disabled. */
  readonly disabled?: boolean;
  /** Callback executed when the player confirms they want to leave. */
  readonly onActivate: () => void | Promise<void>;
}

/**
 * Set of contextual actions exposed to the header. Each field is optional: the header renders
 * controls only when the corresponding configuration is provided.
 */
export interface HeaderActionState {
  readonly invite?: HeaderInviteAction;
  readonly leave?: HeaderLeaveAction;
}

type HeaderActionKey = keyof HeaderActionState;

interface HeaderActionsContextValue {
  readonly actions: HeaderActionState;
  readonly registerActions: (actions: HeaderActionState) => void;
  readonly unregisterActions: (keys: readonly HeaderActionKey[]) => void;
  readonly resetActions: () => void;
}

const HeaderActionsContext = createContext<
  HeaderActionsContextValue | undefined
>(undefined);

/**
 * Provider responsible for storing header actions defined by nested client components.
 */
function HeaderActionsProvider({ children }: { readonly children: ReactNode }) {
  const [actions, setActions] = useState<HeaderActionState>({});

  const registerActions = useCallback((next: HeaderActionState) => {
    setActions((previous) => {
      let changed = false;
      const updated: HeaderActionState = { ...previous };
      if (next.invite) {
        updated.invite = next.invite;
        changed = true;
      }
      if (next.leave) {
        updated.leave = next.leave;
        changed = true;
      }
      return changed ? updated : previous;
    });
  }, []);

  const unregisterActions = useCallback((keys: readonly HeaderActionKey[]) => {
    if (keys.length === 0) {
      return;
    }
    setActions((previous) => {
      let changed = false;
      const updated: HeaderActionState = { ...previous };
      for (const key of keys) {
        if (key in updated) {
          delete updated[key];
          changed = true;
        }
      }
      return changed ? updated : previous;
    });
  }, []);

  const resetActions = useCallback(() => {
    setActions({});
  }, []);

  const value = useMemo<HeaderActionsContextValue>(
    () => ({ actions, registerActions, unregisterActions, resetActions }),
    [actions, registerActions, unregisterActions, resetActions],
  );

  return (
    <HeaderActionsContext.Provider value={value}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

function useHeaderActionsContext(componentName: string) {
  const context = useContext(HeaderActionsContext);
  if (!context) {
    throw new Error(
      `${componentName} must be used within a HeaderActionsProvider.`,
    );
  }
  return context;
}

/**
 * Grants access to the current header actions.
 */
function useHeaderActions() {
  return useHeaderActionsContext("useHeaderActions");
}

/**
 * Registers header actions for the lifetime of the parent component.
 * The provided configuration is reset when the component unmounts.
 */
function useHeaderActionRegistration(actions: HeaderActionState) {
  const { registerActions, unregisterActions } = useHeaderActionsContext(
    "useHeaderActionRegistration",
  );

  const activeKeys = useMemo<HeaderActionKey[]>(() => {
    const keys: HeaderActionKey[] = [];
    if (actions.invite) {
      keys.push("invite");
    }
    if (actions.leave) {
      keys.push("leave");
    }
    return keys;
  }, [actions.invite, actions.leave]);

  useEffect(() => {
    if (activeKeys.length === 0) {
      return;
    }
    registerActions(actions);
    return () => {
      unregisterActions(activeKeys);
    };
  }, [actions, activeKeys, registerActions, unregisterActions]);
}

export { HeaderActionsProvider, useHeaderActions, useHeaderActionRegistration };
