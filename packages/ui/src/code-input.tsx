"use client";

import { useId } from "react";
import { cn } from "./cn";

export type CodeInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  length?: number;
  className?: string;
};

/** Campo de código numérico (MFA). Un solo input accesible con autocompletado de código de un solo uso. */
export function CodeInput({ label, value, onChange, error, length = 6, className }: CodeInputProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-tinta">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={`[0-9]{${length}}`}
        maxLength={length}
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, length))}
        className={cn(
          "min-h-12 rounded-campo border border-borde-campo bg-papel px-3.5 text-center font-titulo text-2xl tracking-[0.5em] text-tinta focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hoja",
          error && "border-guayaba",
          className,
        )}
      />
      {error ? <p className="text-sm font-bold text-tinta">{error}</p> : null}
    </div>
  );
}
