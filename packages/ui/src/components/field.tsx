import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "../cn";

type FieldFrameProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

function FieldFrame({ id, label, hint, error, children }: FieldFrameProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold text-tinta">
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-desc`} className="text-sm text-tinta-suave">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-desc`} role="alert" className="text-sm font-medium text-tinta">
          <span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-guayaba" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

const control =
  "min-h-11 w-full rounded-campo border bg-papel px-3.5 text-base text-tinta placeholder:text-tinta-suave " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-hoja disabled:opacity-50";

type CommonProps = { label: string; hint?: string; error?: string };

export const TextField = forwardRef<HTMLInputElement, CommonProps & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, hint, error, id, className, ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <FieldFrame id={fieldId} label={label} hint={hint} error={error}>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? `${fieldId}-desc` : undefined}
          className={cn(control, error ? "border-2 border-guayaba" : "border-borde-campo", className)}
          {...rest}
        />
      </FieldFrame>
    );
  },
);

export const SelectField = forwardRef<HTMLSelectElement, CommonProps & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, hint, error, id, className, children, ...rest }, ref) {
    const auto = useId();
    const fieldId = id ?? auto;
    return (
      <FieldFrame id={fieldId} label={label} hint={hint} error={error}>
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? `${fieldId}-desc` : undefined}
          className={cn(control, error ? "border-2 border-guayaba" : "border-borde-campo", className)}
          {...rest}
        >
          {children}
        </select>
      </FieldFrame>
    );
  },
);
