"use client";

import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "./cn";

export type CodeInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  length?: number;
  className?: string;
};

/** Código numérico en cajas individuales (MFA). Admite pegar el código completo y navegar con flechas. */
export function CodeInput({ label, value, onChange, error, length = 6, className }: CodeInputProps) {
  const id = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, index) => value[index] ?? "");
  const focusAt = (index: number) => refs.current[Math.max(0, Math.min(length - 1, index))]?.focus();

  function write(index: number, text: string) {
    const clean = text.replace(/\D/g, "");
    if (!clean) return;
    const next = value.slice(0, index) + clean;
    onChange(next.slice(0, length));
    focusAt(Math.min(index + clean.length, length - 1));
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (digits[index]) onChange(value.slice(0, index) + value.slice(index + 1));
      else {
        onChange(value.slice(0, Math.max(0, index - 1)) + value.slice(index));
        focusAt(index - 1);
      }
    } else if (event.key === "ArrowLeft") focusAt(index - 1);
    else if (event.key === "ArrowRight") focusAt(index + 1);
  }

  function onPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    write(index, event.clipboardData.getData("text"));
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} className={cn("flex flex-col gap-1.5", className)}>
      <span id={`${id}-label`} className="text-xs font-bold text-tinta-suave">
        {label}
      </span>
      <div className="flex gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={length}
            value={digit}
            aria-label={`${label}, dígito ${index + 1} de ${length}`}
            aria-invalid={error ? true : undefined}
            onChange={(event) => write(index, event.target.value)}
            onKeyDown={(event) => onKeyDown(index, event)}
            onPaste={(event) => onPaste(index, event)}
            onFocus={(event) => event.target.select()}
            className={cn(
              "size-[52px] rounded-campo border border-borde-campo bg-superficie text-center text-2xl font-extrabold text-tinta transition-colors focus-visible:border-hoja focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hoja",
              error && "border-rojo",
            )}
          />
        ))}
      </div>
      {error ? <p className="text-xs font-bold text-tinta">{error}</p> : null}
    </div>
  );
}
