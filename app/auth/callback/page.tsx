"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { supabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

function parseParams(raw: string) {
  const out: Record<string, string> = {};
  const s = raw.replace(/^[?#]/, "");
  if (!s) return out;

  for (const part of s.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    const key = decodeURIComponent(k.replace(/\+/g, " "));
    const val = decodeURIComponent(v.replace(/\+/g, " "));
    out[key] = val;
  }
  return out;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Finishing authentication…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (typeof window === "undefined") return;

        // Supabase recovery links usually deliver tokens in the URL hash.
        const hashParams = parseParams(window.location.hash);
        const queryParams = parseParams(window.location.search);

        const params = { ...queryParams, ...hashParams };

        const errorDesc = params.error_description || params.error;
        if (errorDesc) {
          setStatus("Link error. Redirecting…");
          router.replace("/auth/reset");
          return;
        }

        const flowType = String(params.type ?? "").toLowerCase();
        const isRecovery = flowType === "recovery";

        const code = params.code;
        const access_token = params.access_token;
        const refresh_token = params.refresh_token;

        if (code) {
          setStatus("Verifying link…");
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (access_token && refresh_token) {
          setStatus("Restoring session…");
          const { error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;
        } else {
          // If we land here without tokens, just send them to reset (it will show guidance)
          setStatus("No token found. Redirecting…");
          router.replace("/auth/reset");
          return;
        }

        if (cancelled) return;

        // For recovery flow always go to reset page.
        if (isRecovery) {
          router.replace("/auth/reset");
        } else {
          // If you ever use this for magic links/email confirm in the future:
          router.replace("/");
        }
      } catch (e: any) {
        if (cancelled) return;
        setStatus("Could not complete authentication. Redirecting…");
        router.replace("/auth/reset");
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>Neat Notes</h1>
      <p style={{ opacity: 0.8 }}>{status}</p>
    </main>
  );
}
