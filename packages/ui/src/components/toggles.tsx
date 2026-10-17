import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "../cn";

type ToggleProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string };

export const Checkbox = forwardRef<HTMLInputElement, ToggleProps>(function Checkbox(
  { label, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={cn("flex min-h-11 items-center gap-3", className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="size-5 rounded border-borde-campo accent-hoja focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
        {...rest}
      />
      <label htmlFor={inputId} className="text-sm text-tinta">
        {label}
      </label>
    </div>
  );
});

export const Switch = forwardRef<HTMLInputElement, ToggleProps>(function Switch(
  { label, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={cn("flex min-h-11 items-center gap-3", className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        className={cn(
          "peer relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-borde-campo transition",
          "checked:bg-hoja focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja",
          "after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-papel after:transition",
          "checked:after:translate-x-5 disabled:opacity-50",
        )}
        {...rest}
      />
      <label htmlFor={inputId} className="text-sm text-tinta">
        {label}
      </label>
    </div>
  );
});
