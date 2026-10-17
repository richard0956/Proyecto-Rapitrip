import { useId, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";
import { fieldBox, fieldLabel } from "./field";

export type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string };

export function TextareaField({ label, error, className, id, ...props }: TextareaFieldProps) {
  const auto = useId();
  const areaId = id ?? auto;
  const errorId = `${areaId}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={areaId} className={fieldLabel}>
        {label}
      </label>
      <div className={cn(fieldBox, "items-start", error && "border-rojo")}>
        <textarea
          id={areaId}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn("min-w-0 flex-1 resize-y bg-transparent py-2.5 text-sm outline-none placeholder:text-tinta-suave", className)}
          {...props}
        />
      </div>
      {error ? (
        <p id={errorId} className="text-xs font-bold text-tinta">
          {error}
        </p>
      ) : null}
    </div>
  );
}
