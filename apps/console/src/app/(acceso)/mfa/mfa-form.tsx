"use client";

import { getSessionInfo, homePathForRole } from "@rapitrip/supabase";
import { createBrowserSupabase } from "@rapitrip/supabase/browser";
import { Alert, Button, CodeInput } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

type Enrollment = { factorId: string; qr: string; secret: string };
type State =
  | { phase: "loading" }
  | { phase: "verify"; factorId: string }
  | { phase: "enroll"; enrollment: Enrollment }
  | { phase: "failed" };

export function MfaForm() {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createBrowserSupabase();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError) return setState({ phase: "failed" });
      const verified = data.totp[0];
      if (verified) return setState({ phase: "verify", factorId: verified.id });

      // Descarta intentos de alta sin terminar para no acumular factores sin verificar.
      for (const factor of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Rapitrip" });
      if (cancelled) return;
      if (enrollError || !enrolled) return setState({ phase: "failed" });
      setState({ phase: "enroll", enrollment: { factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret } });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (state.phase !== "verify" && state.phase !== "enroll") return;
    const factorId = state.phase === "verify" ? state.factorId : state.enrollment.factorId;
    setBusy(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (verifyError) {
      setError("El código no es válido. Revisa tu aplicación e inténtalo de nuevo.");
      setCode("");
      setBusy(false);
      return;
    }
    // La sesión de consola exige actividad reciente: sin este latido inicial, las lecturas y escrituras de los primeros segundos fallan.
    await supabase.rpc("touch_session");
    const session = await getSessionInfo(supabase);
    router.replace(homePathForRole(session.role));
    router.refresh();
  }

  if (state.phase === "loading") return <p className="mt-4 text-sm text-tinta-suave">Preparando verificación…</p>;
  if (state.phase === "failed") {
    return (
      <Alert tone="error" className="mt-4">
        No pudimos preparar la verificación. Recarga la página o vuelve a iniciar sesión.
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
      {state.phase === "enroll" ? (
        <>
          <p className="text-[13.5px] text-tinta-suave">Escanea el código con tu aplicación de autenticación y escribe el código de seis dígitos que muestra.</p>
          <img src={state.enrollment.qr} alt="Código QR para configurar la verificación en dos pasos" width={176} height={176} className="self-center rounded-panel border border-borde bg-white p-2" />
          <p className="text-sm text-tinta-suave">
            ¿No puedes escanear? Clave manual: <code className="break-all font-bold text-tinta">{state.enrollment.secret}</code>
          </p>
        </>
      ) : (
        <p className="text-[13.5px] text-tinta-suave">Escribe el código de 6 dígitos de tu aplicación de autenticación.</p>
      )}
      <CodeInput label="Código de verificación" value={code} onChange={setCode} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button variant="primary" type="submit" className="w-full" disabled={busy || code.length !== 6}>
        {busy ? "Verificando…" : "Verificar y continuar"}
      </Button>
    </form>
  );
}
