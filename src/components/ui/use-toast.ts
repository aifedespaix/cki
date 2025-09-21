import * as React from "react";

import type { ToastActionElement, ToastProps } from "./toast";

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 1200;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type Toast = Omit<ToasterToast, "id">;
type ToastOptions = Toast & { id?: string };

type State = {
  toasts: ToasterToast[];
};

const ADD_TOAST = "ADD_TOAST";
const UPDATE_TOAST = "UPDATE_TOAST";
const DISMISS_TOAST = "DISMISS_TOAST";
const REMOVE_TOAST = "REMOVE_TOAST";

type ActionType =
  | { type: typeof ADD_TOAST; toast: ToasterToast }
  | { type: typeof UPDATE_TOAST; toast: Partial<ToasterToast> }
  | { type: typeof DISMISS_TOAST; toastId?: ToasterToast["id"] }
  | { type: typeof REMOVE_TOAST; toastId?: ToasterToast["id"] };

type Listener = (state: State) => void;

let memoryState: State = { toasts: [] };

const listeners = new Set<Listener>();
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function generateToastId() {
  return Math.random().toString(36).slice(2);
}

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) {
    return;
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: REMOVE_TOAST, toastId });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
}

function dispatch(action: ActionType) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => {
    listener(memoryState);
  });
}

function reducer(state: State, action: ActionType): State {
  switch (action.type) {
    case ADD_TOAST: {
      const newToast = action.toast;

      const existingToasts =
        state.toasts.length >= TOAST_LIMIT
          ? state.toasts.slice(1)
          : state.toasts;

      if (state.toasts.length >= TOAST_LIMIT) {
        const [oldestToast] = state.toasts;
        if (oldestToast) {
          toastTimeouts.delete(oldestToast.id);
        }
      }

      return {
        ...state,
        toasts: [...existingToasts, newToast],
      };
    }
    case UPDATE_TOAST: {
      if (!action.toast.id) {
        return state;
      }

      return {
        ...state,
        toasts: state.toasts.map((toast) =>
          toast.id === action.toast.id ? { ...toast, ...action.toast } : toast,
        ),
      };
    }
    case DISMISS_TOAST: {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id);
        });
      }

      return {
        ...state,
        toasts: state.toasts.map((toast) =>
          toast.id === toastId || toastId === undefined
            ? { ...toast, open: false }
            : toast,
        ),
      };
    }
    case REMOVE_TOAST: {
      if (action.toastId === undefined) {
        return { ...state, toasts: [] };
      }

      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.toastId),
      };
    }
    default: {
      return state;
    }
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);

  React.useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: DISMISS_TOAST, toastId }),
  };
}

function toast({ id: providedId, ...props }: ToastOptions) {
  const id = providedId ?? generateToastId();

  const update = (toastProps: Partial<ToasterToast>) =>
    dispatch({ type: UPDATE_TOAST, toast: { ...toastProps, id } });

  const dismiss = () => dispatch({ type: DISMISS_TOAST, toastId: id });

  dispatch({
    type: ADD_TOAST,
    toast: {
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) {
          dismiss();
        }
      },
      duration: props.duration ?? 2800,
      ...props,
    },
  });

  return {
    id,
    dismiss,
    update,
  };
}

export { useToast, toast };
export type { ToasterToast, ToastOptions };
