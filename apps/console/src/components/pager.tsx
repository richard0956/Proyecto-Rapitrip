import { buttonStyles } from "@rapitrip/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export function Pager({ newerHref, olderHref }: { newerHref?: string; olderHref?: string }) {
  if (!newerHref && !olderHref) return null;
  return (
    <nav aria-label="Paginación" className="mt-4 flex flex-wrap gap-3">
      {newerHref ? (
        <Link href={newerHref} className={buttonStyles({ variant: "secondary" })}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          Más recientes
        </Link>
      ) : null}
      {olderHref ? (
        <Link href={olderHref} className={buttonStyles({ variant: "secondary" })}>
          Más antiguos
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}
