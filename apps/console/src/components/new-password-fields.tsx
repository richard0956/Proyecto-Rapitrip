"use client";

import { Field } from "@rapitrip/ui";
import { generateStrongPassword, passwordChecks, passwordStrength } from "@rapitrip/validation";
import { Check, Circle, Clipboard, ClipboardCheck, Eye, EyeOff, Lock, Sparkles } from "lucide-react";
import { useState } from "react";

type Props = {
  password: string;
  onPasswordChange: (value: string) => void;
  confirm: string;
  onConfirmChange: (value: string) => void;
  errors?: { password?: string; confirm?: string };
  label?: string;
};

const bars = ["bg-borde", "bg-rojo", "bg-naranja", "bg-hoja", "bg-esmeralda"];

/**
 * Contraseña nueva + repetición, con lista de requisitos en vivo, medidor de fuerza y un botón que sugiere una contraseña segura
 * (aleatoria, generada con el generador criptográfico del navegador). Al sugerirla se rellenan las dos casillas y se muestra para
 * que se pueda copiar y guardar. Los gestores de contraseñas (el de Google, el del navegador) siguen funcionando: los campos
 * llevan `autoComplete="new-password"`, que es lo que les avisa para ofrecer su propia sugerencia.
 */
export function NewPasswordFields({ password, onPasswordChange, confirm, onConfirmChange, errors, label = "Contraseña" }: Props) {
  const [visible, setVisible] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const [copied, setCopied] = useState(false);
  const checks = passwordChecks(password);
  const strength = passwordStrength(password);

  function suggest() {
    const value = generateStrongPassword(16);
    onPasswordChange(value);
    onConfirmChange(value);
    setVisible(true);
    setSuggested(true);
    setCopied(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // Sin permiso del portapapeles: la contraseña queda visible para copiarla a mano.
      setCopied(false);
    }
  }

  const type = visible ? "text" : "password";
  const eye = (
    <button
      type="button"
      onClick={() => setVisible((value) => !value)}
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={visible}
      title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      className="flex size-9 items-center justify-center rounded-full text-tinta-suave transition-colors hover:text-tinta focus-visible:outline-2 focus-visible:outline-hoja"
    >
      {visible ? <EyeOff aria-hidden="true" className="size-[18px]" /> : <Eye aria-hidden="true" className="size-[18px]" />}
    </button>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <Field
          label={label}
          icon={<Lock className="size-4" />}
          type={type}
          name="new-password"
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          value={password}
          onChange={(e) => {
            onPasswordChange(e.target.value);
            setSuggested(false);
          }}
          error={errors?.password}
          trailing={eye}
          required
        />

        <div aria-hidden="true" className="flex gap-1">
          {[1, 2, 3, 4].map((step) => (
            <span key={step} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${strength.score >= step ? bars[strength.score] : "bg-borde"}`} />
          ))}
        </div>
        <p className="text-[12px] font-semibold text-tinta-suave" aria-live="polite">
          {strength.label ? `Seguridad: ${strength.label}` : "Crea una contraseña que cumpla estos requisitos:"}
        </p>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2" aria-label="Requisitos de la contraseña">
          {checks.map((check) => (
            <li key={check.id} className={`flex items-center gap-2 text-[12.5px] transition-colors duration-300 ${check.ok ? "font-semibold text-hoja" : "text-tinta-suave"}`}>
              {check.ok ? <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={3} /> : <Circle aria-hidden="true" className="size-3.5 shrink-0" />}
              <span>
                {check.label}
                <span className="sr-only">{check.ok ? ": cumple" : ": falta"}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={suggest}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-menta px-4 text-[13px] font-bold text-selva ring-1 ring-selva/10 transition-colors hover:bg-menta/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
          >
            <Sparkles aria-hidden="true" className="size-4" />
            Sugerir contraseña segura
          </button>
          {suggested ? (
            <button
              type="button"
              onClick={copy}
              className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-hoja hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
            >
              {copied ? <ClipboardCheck aria-hidden="true" className="size-4" /> : <Clipboard aria-hidden="true" className="size-4" />}
              {copied ? "Copiada" : "Copiar"}
            </button>
          ) : null}
        </div>
        {suggested ? (
          <p role="status" className="text-[12.5px] leading-snug text-tinta-suave">
            Te sugerimos esta contraseña. Cópiala y guárdala en tu gestor de contraseñas: después no podrás verla.
          </p>
        ) : null}
      </div>

      <Field
        label="Repite la contraseña"
        icon={<Lock className="size-4" />}
        type={type}
        autoComplete="new-password"
        autoCapitalize="none"
        spellCheck={false}
        value={confirm}
        onChange={(e) => onConfirmChange(e.target.value)}
        error={errors?.confirm}
        trailing={eye}
        required
      />
    </div>
  );
}
