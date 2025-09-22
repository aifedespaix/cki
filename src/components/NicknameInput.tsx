"use client";

import type { FocusEvent } from "react";
import { useId, useMemo, useState } from "react";

export interface NicknameInputProps {
  /** Unique identifier for the input element. */
  inputId?: string;
  /** Name attribute for the input element. */
  name?: string;
  /** Label displayed above the input. */
  label?: string;
  /** Descriptive helper text rendered below the input. */
  description?: string;
  /** Placeholder displayed inside the input field. */
  placeholder?: string;
  /** Maximum number of characters the nickname accepts. */
  maxLength?: number;
  /** Whether the field is required. Defaults to true. */
  required?: boolean;
  /** Custom validation message displayed when the value is empty. */
  requiredMessage?: string;
  /**
   * External flag to force the display of the validation message.
   * Useful when validating on form submission.
   */
  showValidationFeedback?: boolean;
  /** Current nickname value. */
  value: string;
  /** Callback executed when the nickname changes. */
  onValueChange: (value: string) => void;
  /** Optional blur handler executed after the component tracks focus loss. */
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  /** Optional focus handler forwarded to the underlying input. */
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  /** Optional autocomplete hint. */
  autoComplete?: string;
}

const DEFAULT_REQUIRED_MESSAGE =
  "Un pseudo est requis pour identifier chaque participant.";

/**
 * Accessible nickname input with inline validation and helper messaging.
 */
export function NicknameInput({
  inputId,
  name = "nickname",
  label = "Votre pseudo (partagé avec les autres participants)",
  description,
  placeholder = "Hôte de la partie",
  maxLength = 40,
  required = true,
  requiredMessage = DEFAULT_REQUIRED_MESSAGE,
  showValidationFeedback = false,
  value,
  onValueChange,
  onBlur,
  onFocus,
  autoComplete = "off",
}: NicknameInputProps) {
  const reactId = useId();
  const fieldId = inputId ?? reactId;
  const [hasBlurred, setHasBlurred] = useState(false);

  const trimmedValue = value.trim();
  const validationMessage = useMemo(() => {
    if (!required) {
      return null;
    }
    return trimmedValue.length === 0 ? requiredMessage : null;
  }, [required, requiredMessage, trimmedValue]);

  const showValidationMessage =
    Boolean(validationMessage) && (showValidationFeedback || hasBlurred);

  const descriptionId = description ? `${fieldId}-description` : undefined;
  const errorId = showValidationMessage ? `${fieldId}-error` : undefined;
  const describedByEntries = [errorId, descriptionId].filter(
    (identifier): identifier is string => Boolean(identifier),
  );
  const ariaDescribedBy =
    describedByEntries.length > 0 ? describedByEntries.join(" ") : undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={fieldId}
        name={name}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
        onBlur={(event) => {
          setHasBlurred(true);
          onBlur?.(event);
        }}
        onFocus={onFocus}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-invalid={showValidationMessage}
        aria-describedby={ariaDescribedBy}
        autoComplete={autoComplete}
        inputMode="text"
        spellCheck={false}
      />
      {showValidationMessage ? (
        <p id={errorId} className="text-sm text-destructive">
          {validationMessage}
        </p>
      ) : null}
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
