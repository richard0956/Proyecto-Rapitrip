"use client";

import { Turnstile as BaseTurnstile } from "@rapitrip/ui";

type Props = { onToken: (token: string | null) => void; resetKey?: number };

export function Turnstile(props: Props) {
  return <BaseTurnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} {...props} />;
}
