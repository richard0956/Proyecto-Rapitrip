"use client";

import { Alert, Badge, Button, Card, CardHeader, Field } from "@rapitrip/ui";
import { BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-error";
import { SlaBadge } from "./sla-badge";

export type CatalogNotice = { id: string; kind: "sin_actualizar" | "inconsistencia" | "medida"; message: string; createdAt: string; reportId: string | null; reportStatus: string | null; fixDueIso: string | null };

const kindLabel: Record<CatalogNotice["kind"], string> = { sin_actualizar: "Catálogo sin actualizar", inconsistencia: "Inconsistencia confirmada", medida: "Medida de la administración" };

function NoticeItem({ notice, markFixed }: { notice: CatalogNotice; markFixed: (input: { id: string; note: string }) => Promise<ActionResult> }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pendingFix = notice.kind === "inconsistencia" && notice.reportStatus === "confirmado" && notice.reportId;
  return (
    <li className="flex flex-col gap-2 rounded-panel bg-papel p-3.5 ring-1 ring-borde">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] font-bold text-tinta">{kindLabel[notice.kind]}</p>
        <span className="flex items-center gap-1.5">
          {pendingFix && notice.fixDueIso ? <SlaBadge kind="correccion" from={new Date(new Date(notice.fixDueIso).getTime() - 24 * 3_600_000).toISOString()} /> : null}
          {notice.kind === "inconsistencia" && notice.reportStatus === "corregido" ? <Badge tone="positive">Corregido</Badge> : null}
          <span className="text-[12px] text-tinta-suave">{notice.createdAt}</span>
        </span>
      </div>
      <p className="text-[13px] leading-snug text-tinta">{notice.message}</p>
      {pendingFix ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="sm:flex-1">
            <Field label="¿Qué corregiste?" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Actualicé el precio a…" />
          </div>
          <Button
            variant="primary"
            disabled={pending || note.trim().length < 5}
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await markFixed({ id: notice.reportId!, note: note.trim() });
                if (!result.ok) return setError(result.error);
                router.refresh();
              })
            }
          >
            Ya lo corregí
          </Button>
        </div>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </li>
  );
}

/** Avisos de Rapitrip sobre el catálogo del comercio (Política 8): sin actualizar, inconsistencias por corregir en 24 horas y medidas. */
export function CatalogNotices({ notices, markFixed }: { notices: CatalogNotice[]; markFixed: (input: { id: string; note: string }) => Promise<ActionResult> }) {
  if (notices.length === 0) return null;
  const waiting = notices.filter((n) => n.kind === "inconsistencia" && n.reportStatus === "confirmado").length;
  return (
    <Card outerClassName="mb-5" className="p-5">
      <CardHeader
        title="Avisos de Rapitrip sobre tu catálogo"
        subtitle="Mantén precios y disponibilidad al día; las inconsistencias confirmadas se corrigen en 24 horas."
        actions={waiting > 0 ? <Badge tone="danger">{waiting} por corregir</Badge> : <BellRing aria-hidden="true" className="size-5 text-hoja" />}
      />
      <ul className="flex flex-col gap-2.5">
        {notices.slice(0, 6).map((notice) => (
          <NoticeItem key={notice.id} notice={notice} markFixed={markFixed} />
        ))}
      </ul>
    </Card>
  );
}
