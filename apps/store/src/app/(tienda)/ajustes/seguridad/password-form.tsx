"use client";

import { Alert, Button, CodeInput } from "@rapitrip/ui";
import { passwordProblem, passwordStrength } from "@rapitrip/validation";
import { useState, useTransition, type FormEvent } from "react";
import { NewPasswordFields } from "@/components/new-password-fields";
import type { PasswordResult } from "./actions";

// La fuerza orientativa vive en @rapitrip/validation; se reexporta aquí para quien ya la importaba desde este archivo.
export { passwordStrength };

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

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const problem = passwordProblem(password);
    if (problem) return setErrors({ password: problem });
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

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <NewPasswordFields label="Contraseña nueva" password={password} onPasswordChange={setPassword} confirm={confirm} onConfirmChange={setConfirm} errors={errors} />

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
