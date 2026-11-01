"use client";

import { Alert, CodeInput } from "@rapitrip/ui";
import { passwordProblem } from "@rapitrip/validation";
import { Bike, Car, IdCard, KeyRound, LogOut, Mail, MapPin, MonitorSmartphone, Phone, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useCallback, useState } from "react";
import { friendlyError } from "@/lib/api-error";
import { getSupabase } from "@/lib/client";
import { departmentName } from "@/lib/department";
import { passwordResult } from "@/lib/password";
import { signOutCourier } from "@/lib/sign-out";
import type { CourierMe } from "@/lib/types";
import { useAuthGuard } from "@/lib/use-auth-guard";
import { usePolling } from "@/lib/use-polling";
import { vehicleLabel } from "@/lib/vehicle";
import { NewPasswordFields } from "./new-password-fields";
import { SettingsHeader, SettingsSection } from "./settings-header";

const pill = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-bold transition-[background-color,color,transform] duration-500 ease-fluido active:scale-[0.98] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2";

/** Un dato de la ficha: fila crema con su ícono, como los detalles de la tarjeta de propuesta. */
function Row({ icon, label, value }: { icon: ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-crema px-3 py-2.5">
      <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-menta text-hoja">
        {icon}
      </span>
      <dt className="shrink-0 text-[13px] font-semibold text-tinta-suave">{label}</dt>
      <dd className="min-w-0 flex-1 text-right text-[14px] font-bold text-tinta [overflow-wrap:anywhere]">{value || "—"}</dd>
    </div>
  );
}

/** Cuenta: la ficha y el correo (solo lectura: los corrige coordinación), cambiar la contraseña y cerrar sesiones. */
export function AccountView() {
  const supabase = getSupabase();
  const guard = useAuthGuard();
  const [me, setMe] = useState<CourierMe | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [profile, user] = await Promise.all([supabase.from("courier_me").select("*").maybeSingle(), supabase.auth.getUser()]);
    if (profile.error) {
      if (!guard(profile.error)) setError(friendlyError(profile.error, "No pudimos cargar tus datos."));
      return;
    }
    setMe(profile.data as CourierMe | null);
    setEmail(user.data.user?.email ?? null);
    setError(null);
  }, [supabase, guard]);
  usePolling(load, 60_000);

  const VehicleIcon = me?.vehicle_class === "vehiculo" ? Car : Bike;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-4">
      <SettingsHeader icon={<ShieldCheck aria-hidden="true" className="size-3.5" />} title="Cuenta" text="Tus datos, tu contraseña y dónde está abierta tu sesión." />
      {error ? <Alert tone="warning">{error}</Alert> : null}

      <SettingsSection id="datos" icon={<IdCard className="size-5" />} title="Tus datos" text="Si algo está mal, pide a coordinación que lo corrija.">
        <dl className="flex flex-col gap-2">
          <Row icon={<UserRound className="size-4" />} label="Nombre" value={me?.full_name} />
          <Row icon={<Mail className="size-4" />} label="Correo" value={email} />
          <Row icon={<Phone className="size-4" />} label="Teléfono" value={me?.phone} />
          <Row icon={<VehicleIcon className="size-4" />} label="Vehículo" value={vehicleLabel(me)} />
          <Row icon={<MapPin className="size-4" />} label="Departamento" value={departmentName(me?.department)} />
        </dl>
      </SettingsSection>

      <SettingsSection id="contrasena" icon={<KeyRound className="size-5" />} title="Cambiar contraseña" text="Con ella ingresas a la app junto con tu correo.">
        <PasswordForm />
      </SettingsSection>

      <SettingsSection id="sesiones" icon={<MonitorSmartphone className="size-5" />} title="Sesiones" text="Dónde está abierta tu cuenta.">
        <Sessions />
      </SettingsSection>
    </div>
  );
}

/**
 * La contraseña nueva dos veces, con requisitos y medidor. Si Supabase pide confirmar la identidad, se envía un código de 6
 * dígitos al correo y el cambio se completa con él (igual que en la tienda).
 */
function PasswordForm() {
  const supabase = getSupabase();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function sendCode() {
    const { error } = await supabase.auth.reauthenticate();
    return error ? "No pudimos enviar el código. Espera un momento e inténtalo otra vez." : null;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const problem = passwordProblem(password);
    if (problem) return setErrors({ password: problem });
    if (password !== confirm) return setErrors({ confirm: "Las contraseñas no coinciden." });
    if (needsCode && code.length !== 6) return setMessage({ tone: "error", text: "Escribe el código de 6 dígitos que te enviamos." });
    setErrors({});
    setPending(true);
    const { error } = await supabase.auth.updateUser({ password, ...(needsCode ? { nonce: code } : {}) });
    const result = passwordResult(error);
    if (result.ok) {
      setPassword("");
      setConfirm("");
      setCode("");
      setNeedsCode(false);
      setMessage({ tone: "info", text: "Tu contraseña se actualizó." });
    } else if (result.needsCode && !needsCode) {
      const failed = await sendCode();
      setNeedsCode(true);
      setMessage(failed ? { tone: "error", text: failed } : { tone: "info", text: result.error });
    } else {
      setMessage({ tone: "error", text: result.error });
    }
    setPending(false);
  }

  async function resend() {
    setMessage(null);
    setPending(true);
    const failed = await sendCode();
    setMessage(failed ? { tone: "error", text: failed } : { tone: "info", text: "Te enviamos un código nuevo." });
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <NewPasswordFields label="Contraseña nueva" password={password} onPasswordChange={setPassword} confirm={confirm} onConfirmChange={setConfirm} errors={errors} />

      {needsCode ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-crema p-4 ring-1 ring-borde">
          <CodeInput label="Código de verificación" value={code} onChange={setCode} />
          <button type="button" onClick={resend} disabled={pending} className="self-start text-[13px] font-bold text-hoja underline-offset-2 hover:underline disabled:opacity-60">
            Enviarme otro código
          </button>
        </div>
      ) : null}

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <button type="submit" disabled={pending || !password || !confirm} className={`${pill} bg-selva text-sobre-acento shadow-pulsa hover:bg-tinta focus-visible:outline-hoja`}>
        <KeyRound aria-hidden="true" className="size-4" />
        {pending ? "Guardando…" : needsCode ? "Confirmar y guardar" : "Guardar contraseña"}
      </button>
    </form>
  );
}

/**
 * Cerrar la sesión de este teléfono o de todos. «Todos» pide confirmar con un segundo toque, porque también saca de esta pantalla.
 * Antes de salir, este teléfono deja de recibir los avisos de la cuenta.
 */
function Sessions() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState<"local" | "global" | null>(null);

  async function leave(scope: "local" | "global") {
    setLeaving(scope);
    await signOutCourier(scope);
    router.replace("/ingresar");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-3 rounded-2xl bg-crema p-4 ring-1 ring-selva/[0.05]">
        <span>
          <span className="block text-[14px] font-bold text-tinta">Este teléfono</span>
          <span className="block text-[12.5px] text-tinta-suave">Sesión activa ahora.</span>
        </span>
        <button type="button" disabled={leaving !== null} onClick={() => void leave("local")} className={`${pill} bg-superficie text-tinta ring-1 ring-borde hover:bg-menta/60 focus-visible:outline-hoja`}>
          <LogOut aria-hidden="true" className="size-4" />
          {leaving === "local" ? "Saliendo…" : "Cerrar sesión aquí"}
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl p-4 ring-1 ring-rojo/25">
        <span>
          <span className="block text-[14px] font-bold text-tinta">Todos los teléfonos</span>
          <span className="block text-[12.5px] text-tinta-suave">Útil si perdiste tu teléfono o ingresaste en uno ajeno. Tendrás que volver a ingresar en todos.</span>
        </span>
        {confirming ? (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button type="button" disabled={leaving !== null} onClick={() => setConfirming(false)} className={`${pill} bg-crema text-tinta ring-1 ring-borde hover:bg-menta/60 focus-visible:outline-hoja`}>
              No
            </button>
            <button type="button" disabled={leaving !== null} onClick={() => void leave("global")} className={`${pill} bg-rojo text-white hover:opacity-90 focus-visible:outline-rojo dark:text-[#2a151b]`}>
              {leaving === "global" ? "Cerrando…" : "Sí, cerrar en todos"}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={`${pill} bg-rosa text-rojo hover:brightness-95 focus-visible:outline-rojo`}>
            <LogOut aria-hidden="true" className="size-4" />
            Cerrar en todos
          </button>
        )}
      </div>
    </div>
  );
}
