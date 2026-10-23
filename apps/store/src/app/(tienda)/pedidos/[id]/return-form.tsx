"use client";

import { Alert, Button, Card, CardHeader, TextareaField } from "@rapitrip/ui";
import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { photoPath, photoProblem, RETURN_WINDOW_DAYS } from "@/lib/returns";
import type { CustomerResult } from "@/lib/result";

type Props = { orderId: string; customerId: string; request: (orderId: string, reason: string, photos: string[]) => Promise<CustomerResult> };

export function ReturnForm({ orderId, customerId, request }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  async function submit() {
    const problem = photoProblem(files) ?? (reason.trim().length < 5 ? "Cuéntanos el motivo (mínimo 5 caracteres)." : null);
    if (problem) return setMessage({ tone: "error", text: problem });
    setBusy(true);
    setMessage(null);
    try {
      const storage = createBrowserSupabase().storage.from("devoluciones");
      const now = Date.now();
      const paths: string[] = [];
      for (const [index, file] of files.entries()) {
        const path = photoPath(customerId, orderId, index, file.name, now);
        const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error("No pudimos subir una foto. Intenta de nuevo.");
        paths.push(path);
      }
      const result = await request(orderId, reason, paths);
      if (!result.ok) return setMessage({ tone: "error", text: result.error });
      setMessage({ tone: "info", text: result.message ?? "Recibimos tu solicitud." });
      setFiles([]);
      setReason("");
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "No pudimos enviar la solicitud." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeader title="Pedir devolución" subtitle={`Solo para pedidos entregados hace ${RETURN_WINDOW_DAYS} días o menos. Adjunta fotos del producto tal como llegó.`} />
      <div className="flex flex-col gap-3.5">
        <TextareaField label="Motivo (describe qué pasa con el producto)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        <label className="flex flex-col gap-1.5 text-sm font-bold text-tinta">
          Fotos del producto (de 1 a 5)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={busy}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
            className="text-sm font-normal"
          />
          <span className="text-xs font-normal text-tinta-suave">{files.length} seleccionada{files.length === 1 ? "" : "s"}</span>
        </label>
        {message ? <Alert tone={message.tone === "error" ? "error" : "info"}>{message.text}</Alert> : null}
        <Button variant="primary" onClick={submit} disabled={busy} className="self-start">
          {busy ? "Enviando…" : "Enviar solicitud"}
        </Button>
      </div>
    </Card>
  );
}
