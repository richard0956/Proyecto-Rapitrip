"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { Alert } from "@rapitrip/ui";
import { Camera, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AVATAR_BUCKET, avatarPath, avatarProblem } from "@/lib/avatar";
import type { CustomerResult } from "@/lib/result";
import { ProfileAvatar } from "./profile-avatar";

type Props = { userId: string; name: string | null; photo: string | null; currentPath: string | null; save: (input: unknown) => Promise<CustomerResult> };

/**
 * Foto de perfil: se elige una imagen (JPG, PNG o WebP de hasta 2 MB), el navegador la sube a la carpeta del cliente y la
 * acción la registra y borra la anterior. También se puede quitar.
 */
export function AvatarUploader({ userId, name, photo, currentPath, save }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function finish(result: CustomerResult) {
    if (!result.ok && result.expired) return router.replace(`/ingresar?next=${encodeURIComponent("/ajustes")}&expirada=1`);
    setMessage(result.ok ? { tone: "info", text: result.message ?? "Listo." } : { tone: "error", text: result.error });
    if (result.ok) router.refresh();
  }

  function upload(file: File) {
    setMessage(null);
    const problem = avatarProblem(file);
    if (problem) return setMessage({ tone: "error", text: problem });
    setPreview(URL.createObjectURL(file));
    start(async () => {
      const path = avatarPath(userId, file.name);
      const { error } = await createBrowserSupabase().storage.from(AVATAR_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        setPreview(null);
        return setMessage({ tone: "error", text: "No pudimos subir la foto. Revisa tu conexión e inténtalo de nuevo." });
      }
      finish(await save({ path, previous: currentPath }));
    });
  }

  function remove() {
    setMessage(null);
    setPreview(null);
    start(async () => finish(await save({ path: null, previous: currentPath })));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <ProfileAvatar name={name} src={preview ?? photo} className={`size-20 text-2xl ring-4 ring-menta transition-opacity ${pending ? "opacity-60" : ""}`} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Elegir foto de perfil"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload(file);
            }}
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => input.current?.click()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-selva px-5 text-[13px] font-semibold text-sobre-acento shadow-pulsa transition-colors hover:bg-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja disabled:opacity-60"
          >
            <Camera aria-hidden="true" className="size-4" />
            {pending ? "Guardando…" : photo ? "Cambiar foto" : "Subir foto"}
          </button>
          {photo ? (
            <button type="button" disabled={pending} onClick={remove} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-rojo hover:bg-rosa focus-visible:outline-2 focus-visible:outline-hoja disabled:opacity-60">
              <Trash2 aria-hidden="true" className="size-4" />
              Quitar
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-[12.5px] text-tinta-suave">JPG, PNG o WebP de hasta 2 MB. Solo tú la ves en tu cuenta.</p>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
    </div>
  );
}
