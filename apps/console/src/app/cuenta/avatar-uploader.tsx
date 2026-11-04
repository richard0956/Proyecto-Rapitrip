"use client";

import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { Alert, Button } from "@rapitrip/ui";
import { Camera, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ProfilePhoto } from "@/components/profile-photo";
import type { ActionResult } from "@/lib/action-error";
import { AVATAR_BUCKET, avatarPath, avatarProblem } from "@/lib/avatar";

type Props = { userId: string; name: string | null; photo: string | null; currentPath: string | null; save: (input: unknown) => Promise<ActionResult> };

/**
 * Foto de perfil: se elige una imagen (JPG, PNG o WebP de hasta 2 MB), el navegador la sube a la carpeta de la cuenta y la
 * acción la registra y borra la anterior. Se ve en la barra lateral y arriba a la derecha de la propia consola (el bucket es
 * privado: solo la ve su dueño).
 */
export function AvatarUploader({ userId, name, photo, currentPath, save }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function finish(result: ActionResult) {
    setMessage(result.ok ? { tone: "info", text: result.message ?? "Listo." } : { tone: "error", text: result.error });
    if (result.ok) router.refresh();
    else setPreview(null);
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <ProfilePhoto name={name} src={preview ?? photo} className={`size-20 text-2xl ring-4 ring-menta transition-opacity ${pending ? "opacity-60" : ""}`} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-label="Elegir foto de perfil"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload(file);
            }}
          />
          <Button variant="primary" disabled={pending} onClick={() => input.current?.click()} className="min-h-10 px-4">
            <Camera aria-hidden="true" className="size-4" />
            {pending ? "Guardando…" : photo ? "Cambiar foto" : "Subir foto"}
          </Button>
          {photo ? (
            <Button variant="ghost" disabled={pending} onClick={remove} className="min-h-10 px-4 text-rojo hover:bg-rosa">
              <Trash2 aria-hidden="true" className="size-4" />
              Quitar
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-[12.5px] text-tinta-suave">JPG, PNG o WebP de hasta 2 MB. Se muestra en tu barra lateral; el resto del equipo no la ve.</p>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
    </div>
  );
}
