// neatnotes-web/app/auth/callback/page.tsx
"use client";

import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [msg, setMsg] = useState("Finishing authentication…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // Supabase can return:
        // - ?code=... (PKCE flow)  -> exchangeCodeForSession
        // - hash tokens (#access_token=...&refresh_token=...) -> setSession
        const code = search.get("code");

        // Parse hash tokens if present
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
        const access_token = hashParams.get("access_token") ?? "";
        const refresh_token = hashParams.get("refresh_token") ?? "";
        const error = search.get("error") || hashParams.get("error");
        const error_description = search.get("error_description") || hashParams.get("error_description");

        if (error || error_description) {
          throw new Error(String(error_description || error));
        }

        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        } else if (access_token && refresh_token) {
          const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
          if (setErr) throw setErr;
        }

        // At this point we should have a session if the link was valid.
        const { data } = await supabase.auth.getSession();
        const authed = !!data.session?.user;

        if (cancelled) return;

        if (!authed) {
          setMsg("No session found. Please request a new reset email and try again.");
          return;
        }

        // Send them to the reset page (Pattern B UX)
        router.replace("/auth/reset");
      } catch (e: any) {
        if (cancelled) return;
        setMsg(String(e?.message ?? e ?? "Auth callback failed."));
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [router, search]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>Neat Notes</h1>
      <p>{msg}</p>
    </main>
  );
}
