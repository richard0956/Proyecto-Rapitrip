import { buttonStyles } from "@rapitrip/ui";
import Link from "next/link";

/** Paginación por enlaces (funciona sin JavaScript y es indexable). `hasNext` viene de pedir una página y ver si llegó llena. */
export function Pager({ page, hasNext, href }: { page: number; hasNext: boolean; href: (page: number) => string }) {
  if (page <= 1 && !hasNext) return null;
  return (
    <nav aria-label="Paginación" className="mt-8 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={buttonStyles({ variant: "secondary" })}>
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-[13px] font-bold text-tinta-suave">Página {page}</span>
      {hasNext ? (
        <Link href={href(page + 1)} rel="next" className={buttonStyles({ variant: "secondary" })}>
          Siguiente
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
