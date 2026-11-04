import { cn, initials } from "@rapitrip/ui";

/** Foto de perfil redonda; sin foto, las iniciales sobre menta (igual que `Avatar`). */
export function ProfilePhoto({ name, src, className, tone = "light" }: { name: string | null | undefined; src: string | null; className?: string; tone?: "light" | "dark" }) {
  return (
    <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold", tone === "dark" ? "bg-esmeralda text-selva" : "bg-menta text-hoja", className)}>
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials(name)}
    </span>
  );
}
