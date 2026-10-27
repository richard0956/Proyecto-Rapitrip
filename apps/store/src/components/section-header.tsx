import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** Título de sección de la portada con la píldora negra «Ver todo» y su círculo blanco con flecha. */
export function SectionHeader({ id, title, text, href, linkLabel = "Ver todo" }: { id: string; title: ReactNode; text?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="text-[24px] font-bold leading-tight tracking-tight text-tinta sm:text-[30px]">
          {title}
        </h2>
        {text ? <p className="mt-1 text-[14px] text-tinta-suave">{text}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-tinta py-1 pl-4 pr-1 text-[13px] font-semibold text-white transition-colors duration-500 ease-fluido hover:bg-selva focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
        >
          {linkLabel}
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-white text-tinta transition-transform duration-500 ease-fluido group-hover:translate-x-0.5">
            <ChevronRight className="size-4" />
          </span>
        </Link>
      ) : null}
    </div>
  );
}
