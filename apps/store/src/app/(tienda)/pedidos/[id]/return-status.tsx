import { Badge, Card, CardHeader } from "@rapitrip/ui";
import { returnStatusText, type ReturnStatus } from "@/lib/returns";

type Props = { status: ReturnStatus; paymentMethod: "tarjeta" | "efectivo"; reason: string; photoCount: number; decisionNote: string | null; requestedAt: string };

const tone: Record<ReturnStatus, "warning" | "positive" | "danger"> = { solicitada: "warning", aprobada: "positive", rechazada: "danger" };

export function ReturnStatusCard({ status, paymentMethod, reason, photoCount, decisionNote, requestedAt }: Props) {
  const text = returnStatusText(status, paymentMethod);
  return (
    <Card className="p-5">
      <CardHeader title="Tu devolución" actions={<Badge tone={tone[status]}>{text.title}</Badge>} />
      <p className="text-sm text-tinta">{text.detail}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-tinta-suave">Enviada</dt>
        <dd>{requestedAt}</dd>
        <dt className="text-tinta-suave">Motivo</dt>
        <dd>{reason}</dd>
        <dt className="text-tinta-suave">Fotos</dt>
        <dd>{photoCount}</dd>
        {decisionNote ? (
          <>
            <dt className="text-tinta-suave">Decisión</dt>
            <dd>{decisionNote}</dd>
          </>
        ) : null}
      </dl>
    </Card>
  );
}
