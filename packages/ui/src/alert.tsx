import { CircleAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type AlertProps = HTMLAttributes<HTMLDivElement> & { tone?: "info" | "error" | "warning"; icon?: ReactNode };

const tones = {
  info: { box: "bg-menta text-hoja", Icon: ShieldCheck },
  error: { box: "bg-rosa text-rojo", Icon: CircleAlert },
  warning: { box: "bg-durazno text-durazno-texto", Icon: TriangleAlert },
} as const;

/** Aviso en línea. Los errores usan `role="alert"`; el resto, `role="status"`. */
export function Alert({ tone = "info", icon, className, children, ...props }: AlertProps) {
  const { box, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[12.5px] font-medium", box, className)} {...props}>
      <span aria-hidden="true" className="mt-px shrink-0">
        {icon ?? <Icon className="size-[18px]" />}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
