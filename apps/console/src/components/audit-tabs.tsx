import { pillStyles } from "@rapitrip/ui";
import Link from "next/link";

const tabs = [
  { href: "/admin/auditoria", label: "Auditoría de acciones" },
  { href: "/admin/accesos", label: "Inicios de sesión" },
];

export function AuditTabs({ active }: { active: "/admin/auditoria" | "/admin/accesos" }) {
  return (
    <nav aria-label="Registros" className="mb-5 flex flex-wrap gap-2.5">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={tab.href === active ? "page" : undefined} className={pillStyles(tab.href === active)}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
