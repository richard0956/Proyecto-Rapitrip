import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; icon?: ReactNode; hint?: string; hideLabel?: boolean };

export const fieldLabel = "text-xs font-bold text-tinta-suave";
export const fieldBox =
  "flex min-h-11 items-center gap-2 rounded-campo border border-borde-campo bg-white px-3.5 text-tinta transition-colors focus-within:border-hoja focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-hoja";

export function Field({ label, error, icon, hint, hideLabel, className, id, ...props }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const messageId = `${inputId}-message`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={cn(fieldLabel, hideLabel && "sr-only")}>
        {label}
      </label>
      <div className={cn(fieldBox, error && "border-rojo")}>
        {icon ? (
          <span aria-hidden="true" className="shrink-0 text-tinta-suave">
            {icon}
          </span>
        ) : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={cn("min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-tinta-suave", className)}
          {...props}
        />
      </div>
      {error || hint ? (
        <p id={messageId} className={cn("text-xs", error ? "font-bold text-tinta" : "text-tinta-suave")}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
