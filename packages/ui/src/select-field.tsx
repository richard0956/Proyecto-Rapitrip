import { ChevronDown } from "lucide-react";
import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";
import { fieldBox, fieldLabel } from "./field";

export type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string };

export function SelectField({ label, error, hint, className, id, children, ...props }: SelectFieldProps) {
  const auto = useId();
  const selectId = id ?? auto;
  const messageId = `${selectId}-message`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className={fieldLabel}>
        {label}
      </label>
      <div className={cn(fieldBox, "relative p-0", error && "border-rojo")}>
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          className={cn("min-h-[42px] w-full cursor-pointer appearance-none bg-transparent py-2.5 pl-3.5 pr-10 text-sm outline-none", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 size-4 text-tinta-suave" />
      </div>
      {error || hint ? (
        <p id={messageId} className={cn("text-xs", error ? "font-bold text-tinta" : "text-tinta-suave")}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}
