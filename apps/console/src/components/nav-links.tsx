"use client";

import { cn } from "@rapitrip/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/nav";

export function NavLinks({ items }: { items: Pick<NavItem, "href" | "label">[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.href === pathname || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "min-h-10 rounded-campo px-3 py-2 text-sm font-bold text-papel hover:bg-hoja focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-menta-borde",
              active && "bg-mango text-tinta hover:bg-mango",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
