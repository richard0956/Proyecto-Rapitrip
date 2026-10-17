import { useId, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

export type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string };

export function TextareaField({ label, error, className, id, ...props }: TextareaFieldProps) {
  const auto = useId();
  const areaId = id ?? auto;
  const errorId = `${areaId}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={areaId} className="text-sm font-bold text-tinta">
        {label}
      </label>
      <textarea
        id={areaId}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "rounded-campo border border-borde-campo bg-papel px-3.5 py-2.5 text-base text-tinta placeholder:text-tinta-suave focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hoja",
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
