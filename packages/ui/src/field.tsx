import { useId, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export function Field({ label, error, className, id, ...props }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const errorId = `${inputId}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-bold text-tinta">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "min-h-11 rounded-campo border border-borde-campo bg-papel px-3.5 text-base text-tinta placeholder:text-tinta-suave focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hoja",
          error && "border-guayaba",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} className="text-sm font-bold text-tinta">
          {error}
        </p>
      ) : null}
    </div>
  );
}
