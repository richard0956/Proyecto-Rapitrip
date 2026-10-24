"use client";

import { Alert, Button, buttonStyles, Card, CardHeader, cn } from "@rapitrip/ui";
import { ArrowLeft, Banknote, Copy, MapPin, Navigation, Phone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { friendlyError } from "@/lib/api-error";
import { captureEvidence } from "@/lib/capture";
import { getSupabase } from "@/lib/client";
import { mapsUrl, telHref } from "@/lib/links";
import { formatMoney } from "@/lib/money";
import { canRelease, canReportNoFit, stepFor } from "@/lib/order-steps";
import { parseItems, type CourierMe, type CourierOrderDetail, type OrderEvidence, type OrderIssue } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { useEvidenceQueue } from "@/lib/use-evidence-queue";
import { usePolling } from "@/lib/use-polling";
import { ConnectionBanner } from "./connection-banner";
import { DeliverPanel } from "./deliver-panel";
import { EvidenceList } from "./evidence-list";
import { PhotoCapture } from "./photo-capture";
import { PickupPanel } from "./pickup-panel";
import { ReasonDialog } from "./reason-dialog";
import { ClassBadge, StatusBadge } from "./status-badge";

const POLL_MS = 15_000;
type Dialog = "problema" | "no_cabe" | "devolver" | "no_entregado" | null;
const issueLabels: Record<string, string> = { no_entregado: "No se pudo entregar", no_cabe: "No cabe en mi vehículo", problema: "Problema", devuelto: "Pedido devuelto" };

function ActionLink({ href, icon, children }: { href: string | null; icon: React.ReactNode; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target={href.startsWith("tel:") ? undefined : "_blank"} rel="noopener noreferrer" className={cn(buttonStyles({ variant: "secondary" }), "min-h-12 flex-1")}>
      {icon}
      {children}
    </a>
  );
}

/** Todo lo que el repartidor necesita de un pedido propio: qué sigue, a dónde ir, a quién llamar, y los pasos de recoger y entregar. */
export function OrderView({ id }: { id: string }) {
  const supabase = getSupabase();
  const router = useRouter();
  const guard = useAuthGuard();
  const [me, setMe] = useState<CourierMe | null>(null);
  const [order, setOrder] = useState<CourierOrderDetail | null>(null);
  const [evidence, setEvidence] = useState<OrderEvidence[]>([]);
  const [issues, setIssues] = useState<OrderIssue[]>([]);
  const [cashCode, setCashCode] = useState<string | null>(null);
  const [state, setState] = useState<"cargando" | "listo" | "ausente">("cargando");
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [meResult, orderResult, evidenceResult, issuesResult] = await Promise.all([
      supabase.from("courier_me").select("*").maybeSingle(),
      supabase.rpc("courier_order", { p_order: id }),
      supabase.rpc("courier_order_evidence", { p_order: id }),
      supabase.rpc("courier_order_issues", { p_order: id }),
    ]);
    if (guard(orderResult.error ?? meResult.error)) return;
    if (orderResult.error) {
      if (orderResult.error.code === "P0002") return setState("ausente");
      return setNotice(friendlyError(orderResult.error, "No pudimos actualizar. Reintentamos solos."));
    }
    const detail = orderResult.data?.[0] ?? null;
    if (!detail) return setState("ausente");
    setMe(meResult.data as CourierMe | null);
    setOrder(detail);
    setEvidence(evidenceResult.data ?? []);
    setIssues(issuesResult.data ?? []);
    if (detail.status === "entregado" && detail.payment_method === "efectivo") {
      const code = await supabase.rpc("courier_cash_code", { p_order: id });
      setCashCode(code.error ? null : (code.data as string | null));
    }
    setNotice(null);
    setState("listo");
  }, [supabase, guard, id]);

  usePolling(load, POLL_MS);
  const queue = useEvidenceQueue(me?.id ?? null, load);

  const mine = queue.pending.filter((item) => item.orderId === id);
  const uploadedAt = (kind: string) => evidence.find((item) => item.kind === kind)?.taken_at ?? null;
  const pendingKind = (kind: string) => mine.some((item) => item.kind === kind);

  const photo = useCallback((kind: "recogida" | "entrega" | "fallida", units: number | null = null) => (file: Blob) => captureEvidence(queue.submit, { orderId: id, kind, file, units }), [queue.submit, id]);

  async function pickUp(code: string) {
    const { data, error } = await supabase.rpc("courier_pick_up", { p_order: id, p_code: code });
    if (error) return guard(error) ? { error: "" } : { error: friendlyError(error) };
    if (data === "ok") await load();
    return { result: String(data) };
  }

  async function deliver(input: { code: string; cash: number | null; receivedBy: string | null; note: string | null }) {
    const { data, error } = await supabase.rpc("courier_deliver", {
      p_order: id,
      p_code: input.code,
      ...(input.cash !== null ? { p_cash: input.cash } : {}),
      ...(input.receivedBy ? { p_received_by: input.receivedBy } : {}),
      ...(input.note ? { p_note: input.note } : {}),
    });
    if (error) return guard(error) ? { error: "" } : { error: friendlyError(error) };
    if (data === "ok") await load();
    return { result: String(data) };
  }

  async function report(kind: "problema" | "no_cabe" | "no_entregado", reason: string): Promise<string | null> {
    const { error } = await supabase.rpc("courier_report_problem", { p_order: id, p_kind: kind, p_reason: reason });
    if (error) return guard(error) ? "" : friendlyError(error);
    setNotice("Avisamos a coordinación.");
    await load();
    return null;
  }

  async function release(reason: string): Promise<string | null> {
    const { error } = await supabase.rpc("courier_release_order", { p_order: id, p_reason: reason });
    if (error) return guard(error) ? "" : friendlyError(error);
    router.replace("/");
    router.refresh();
    return null;
  }

  async function copyCode() {
    if (!cashCode) return;
    try {
      await navigator.clipboard.writeText(cashCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (state === "cargando") {
    return (
      <p role="status" className="px-4 py-16 text-center text-sm text-tinta-suave">
        Cargando el pedido…
      </p>
    );
  }
  if (state === "ausente" || !order) {
    return (
      <div className="flex flex-col gap-4 px-4 py-10">
        <Alert tone="warning">Este pedido ya no está en tu lista. Pudo cancelarse o reasignarse.</Alert>
        <Link href="/" className={buttonStyles({ variant: "primary" })}>
          Volver al inicio
        </Link>
      </div>
    );
  }

  const step = stepFor(order.status);
  const items = parseItems(order.items);
  const cashTotal = order.cash_total != null ? Number(order.cash_total) : null;
  const delivery = order.delivery_address != null || order.delivery_phone != null;
  const openIssues = issues.filter((issue) => issue.status === "abierta");
  const hasFailedPhoto = evidence.some((item) => item.kind === "fallida");

  return (
    <div className="flex flex-col">
      <ConnectionBanner pending={mine.length} />
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <Link href="/" aria-label="Volver al inicio" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-papel shadow-suave focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-extrabold leading-tight text-tinta">Pedido {order.number}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <StatusBadge status={order.status} />
            <ClassBadge value={order.delivery_class} />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-6">
        {notice ? <Alert tone="info">{notice}</Alert> : null}
        <Alert tone={step.key === "entregado" ? "info" : "warning"}>
          <span className="font-bold">{step.title}.</span> {step.hint}
        </Alert>

        {openIssues.map((issue) => (
          <Alert key={issue.issue_id} tone="warning">
            <span className="font-bold">{issueLabels[issue.kind ?? ""] ?? "Aviso"}:</span> ya avisaste a coordinación. Espera su respuesta.
          </Alert>
        ))}

        <Card className="flex flex-col gap-3 p-4">
          <CardHeader title="Tienda" subtitle={order.store_name ?? undefined} />
          <p className="flex items-start gap-2 text-[14px]">
            <MapPin className="mt-0.5 size-[18px] shrink-0 text-hoja" aria-hidden="true" />
            <span>{order.store_address ?? "La tienda no tiene dirección cargada. Llama para confirmarla."}</span>
          </p>
          <div className="flex gap-2">
            <ActionLink href={mapsUrl({ latitude: order.store_latitude, longitude: order.store_longitude, address: order.store_address })} icon={<Navigation className="size-4" />}>
              Cómo llegar
            </ActionLink>
            <ActionLink href={telHref(order.store_phone)} icon={<Phone className="size-4" />}>
              Llamar
            </ActionLink>
          </div>
        </Card>

        {delivery ? (
          <Card className="flex flex-col gap-3 p-4">
            <CardHeader title="Entrega" subtitle={order.client_first_name ? `Para ${order.client_first_name}` : undefined} />
            <p className="flex items-start gap-2 text-[14px]">
              <MapPin className="mt-0.5 size-[18px] shrink-0 text-hoja" aria-hidden="true" />
              <span>{order.delivery_address ?? "Sin dirección"}</span>
            </p>
            {order.delivery_notes ? <p className="rounded-campo bg-calido px-3 py-2 text-[13px] text-tinta">«{order.delivery_notes}»</p> : null}
            <div className="flex gap-2">
              <ActionLink href={mapsUrl({ latitude: order.dest_latitude, longitude: order.dest_longitude, address: order.delivery_address })} icon={<Navigation className="size-4" />}>
                Cómo llegar
              </ActionLink>
              <ActionLink href={telHref(order.delivery_phone)} icon={<Phone className="size-4" />}>
                Llamar
              </ActionLink>
            </div>
          </Card>
        ) : null}

        <Card className="p-4">
          <CardHeader title="Productos" subtitle={`${items.reduce((n, item) => n + item.quantity, 0)} en total`} />
          <ul className="flex flex-col gap-1.5 text-[14px]">
            {items.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex gap-2">
                <span className="font-extrabold tabular-nums">{item.quantity}×</span>
                <span>
                  {item.name}
                  {item.variant ? <span className="text-tinta-suave"> · {item.variant}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {cashTotal !== null && order.status !== "entregado" ? (
            <p className="mt-3 flex items-center gap-2 rounded-campo bg-durazno px-3 py-2 text-sm font-extrabold text-durazno-texto">
              <Banknote className="size-5" aria-hidden="true" /> Cobras {formatMoney(cashTotal)} en efectivo
            </p>
          ) : null}
        </Card>

        {step.key === "recoger" ? (
          <PickupPanel uploadedAt={uploadedAt("recogida")} pending={pendingKind("recogida")} onPhoto={(file, units) => photo("recogida", units)(file)} onConfirm={pickUp} />
        ) : null}

        {step.key === "entregar" ? (
          <>
            <DeliverPanel uploadedAt={uploadedAt("entrega")} pending={pendingKind("entrega")} cashTotal={cashTotal} onPhoto={photo("entrega")} onConfirm={deliver} />
            <Button variant="secondary" className="min-h-12" onClick={() => setDialog("no_entregado")}>
              No pude entregar
            </Button>
          </>
        ) : null}

        {step.key === "entregado" ? (
          <Card className="flex flex-col gap-3 p-4">
            <CardHeader title="Entrega registrada" subtitle="Gracias. Quedó guardada con foto, código y hora." />
            {cashCode ? (
              <div className="flex flex-col gap-2 rounded-panel bg-menta p-4 text-center">
                <p className="text-xs font-bold text-hoja">Código de efectivo para el cajero</p>
                <p className="font-mono text-3xl font-extrabold tracking-widest text-tinta">{cashCode}</p>
                <Button variant="secondary" className="min-h-12" onClick={copyCode}>
                  <Copy className="size-4" aria-hidden="true" />
                  {copied ? "Copiado" : "Copiar código"}
                </Button>
                <p className="text-xs text-tinta-suave">Lleva el efectivo ({formatMoney(cashTotal)}) a la caja y entrega este código.</p>
              </div>
            ) : null}
          </Card>
        ) : null}

        <EvidenceList evidence={evidence} pendingKinds={mine.map((item) => item.kind)} />

        {step.key !== "entregado" && step.key !== "cerrado" ? (
          <section aria-labelledby="ayuda" className="flex flex-col gap-2">
            <h2 id="ayuda" className="text-sm font-extrabold text-tinta">
              ¿Algo no sale bien?
            </h2>
            <Button variant="soft" className="min-h-12" onClick={() => setDialog("problema")}>
              Avisar un problema a coordinación
            </Button>
            {canReportNoFit(order.status, order.delivery_class) ? (
              <Button variant="soft" className="min-h-12" onClick={() => setDialog("no_cabe")}>
                No cabe en mi vehículo
              </Button>
            ) : null}
            {canRelease(order.status) ? (
              <Button variant="danger" className="min-h-12" onClick={() => setDialog("devolver")}>
                Devolver este pedido
              </Button>
            ) : null}
          </section>
        ) : null}
      </div>

      <ReasonDialog open={dialog === "problema"} onClose={() => setDialog(null)} title="Avisar un problema" description="Coordinación recibirá el aviso y te dirá qué hacer. El pedido no cambia de estado." confirmLabel="Avisar" onConfirm={(reason) => report("problema", reason)} />
      <ReasonDialog open={dialog === "no_cabe"} onClose={() => setDialog(null)} title="No cabe en mi vehículo" description="Coordinación podrá pasarlo a un envío programado con un vehículo más grande." confirmLabel="Avisar" onConfirm={(reason) => report("no_cabe", reason)} />
      <ReasonDialog open={dialog === "devolver"} onClose={() => setDialog(null)} title="Devolver el pedido" description="El pedido volverá a coordinación para que lo asigne a otra persona. Solo puedes devolverlo antes de recogerlo." confirmLabel="Devolver" danger onConfirm={release} />
      <ReasonDialog
        open={dialog === "no_entregado"}
        onClose={() => setDialog(null)}
        title="No pude entregar"
        description="Toma una foto del intento (la puerta, el lugar) y cuéntanos qué pasó. Coordinación decidirá qué hacer."
        confirmLabel="Enviar aviso"
        onConfirm={(reason) => report("no_entregado", reason)}
        blocked={hasFailedPhoto ? null : "Antes de enviar, toma la foto del intento."}
      >
        <PhotoCapture label="Foto del intento de entrega" uploadedAt={uploadedAt("fallida")} pending={pendingKind("fallida")} allowRetake onCapture={photo("fallida")} />
      </ReasonDialog>
    </div>
  );
}
