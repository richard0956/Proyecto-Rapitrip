import { cn, initials } from "@rapitrip/ui";

/** Foto del cliente o, sin foto, sus iniciales sobre el esmeralda. Decorativa: el nombre ya va escrito al lado. */
export function ProfileAvatar({ name, src, className }: { name: string | null | undefined; src: string | null; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-esmeralda font-bold text-panel", className)}>
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials(name)}
    </span>
  );
}
