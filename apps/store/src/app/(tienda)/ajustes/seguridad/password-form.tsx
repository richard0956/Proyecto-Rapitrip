"use client";

import { Alert, Button, CodeInput, Field } from "@rapitrip/ui";
import { passwordSchema } from "@rapitrip/validation";
import { Lock } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import type { PasswordResult } from "./actions";

/** Fuerza orientativa: largo, mayúsculas y minúsculas, números y símbolos. Solo informa; la regla real es 8 a 72 caracteres. */
export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  const value = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  return { score: value, label: ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"][value] ?? "" };
}

type Actions = { change: (input: unknown) => Promise<PasswordResult>; sendCode: () => Promise<PasswordResult> };

/**
 * Cambio de contraseña dentro de la cuenta: la nueva dos veces, con medidor de fuerza. Si Supabase pide confirmar la identidad,
 * se envía un código de 6 dígitos al correo y el cambio se completa con él.
 */
export function PasswordForm({ actions }: { actions: Actions }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const strength = passwordStrength(password);

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!passwordSchema.safeParse(password).success) return setErrors({ password: "La contraseña debe tener entre 8 y 72 caracteres." });
    if (password !== confirm) return setErrors({ confirm: "Las contraseñas no coinciden." });
    if (needsCode && code.length !== 6) return setMessage({ tone: "error", text: "Escribe el código de 6 dígitos que te enviamos." });
    setErrors({});
    start(async () => {
      const result = await actions.change({ password, ...(needsCode ? { code } : {}) });
      if (result.ok) {
        setPassword("");
        setConfirm("");
        setCode("");
        setNeedsCode(false);
        setMessage({ tone: "info", text: "Tu contraseña se actualizó." });
        return;
      }
      if (result.needsCode && !needsCode) {
        const sent = await actions.sendCode();
        setNeedsCode(true);
        setMessage(sent.ok ? { tone: "info", text: result.error } : { tone: "error", text: sent.error });
        return;
      }
      setMessage({ tone: "error", text: result.error });
    });
  }

  function resend() {
    setMessage(null);
    start(async () => {
      const sent = await actions.sendCode();
      setMessage(sent.ok ? { tone: "info", text: "Te enviamos un código nuevo." } : { tone: "error", text: sent.error });
    });
  }

  const bar = ["bg-borde", "bg-rojo", "bg-naranja", "bg-hoja", "bg-esmeralda"][strength.score];
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Field label="Contraseña nueva" icon={<Lock className="size-4" />} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} required />
          <div aria-hidden="true" className="flex gap-1">
            {[1, 2, 3, 4].map((step) => (
              <span key={step} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${strength.score >= step ? bar : "bg-borde"}`} />
            ))}
          </div>
          <p className="text-[12px] text-tinta-suave" aria-live="polite">
            {strength.label ? `Seguridad: ${strength.label}` : "Entre 8 y 72 caracteres. Mezcla letras, números y símbolos."}
          </p>
        </div>
        <Field label="Repite la contraseña" icon={<Lock className="size-4" />} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} required />
      </div>

      {needsCode ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-crema/70 p-4 ring-1 ring-borde">
          <CodeInput label="Código de verificación" value={code} onChange={setCode} />
          <button type="button" onClick={resend} disabled={pending} className="self-start text-[13px] font-bold text-hoja underline-offset-2 hover:underline disabled:opacity-60">
            Enviarme otro código
          </button>
        </div>
      ) : null}

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <Button variant="primary" type="submit" disabled={pending || !password || !confirm} className="self-start">
        {pending ? "Guardando…" : needsCode ? "Confirmar y guardar" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
