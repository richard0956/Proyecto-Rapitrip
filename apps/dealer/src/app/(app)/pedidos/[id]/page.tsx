import { notFound } from "next/navigation";
import { z } from "zod";
import { OrderView } from "@/components/order-view";

export const metadata = { title: "Pedido" };

export default async function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  return <OrderView id={id} />;
}
