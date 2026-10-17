import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string };

export function SelectField({ label, error, className, id, children, ...props }: SelectFieldProps) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-bold text-tinta">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "min-h-11 rounded-campo border border-borde-campo bg-papel px-3 text-base text-tinta focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hoja",
          error && "border-guayaba",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? <p className="text-sm font-bold text-tinta">{error}</p> : null}
    </div>
  );
}
