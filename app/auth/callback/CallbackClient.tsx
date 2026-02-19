"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

function parseParamsFromUrl(url: string) {
  const out: Record<string, string> = {};

  const grab = (s: string) => {
    if (!s) return;
    s.split("&").forEach((pair) => {
      if (!pair) return;
      const idx = pair.indexOf("=");
      const k = idx >= 0 ? pair.slice(0, idx) : pair;
      const v = idx >= 0 ? pair.slice(idx + 1) : "";
      if (!k) return;

      const key = decodeURIComponent(k.replace(/\+/g, " "));
      const val = decodeURIComponent(v.replace(/\+/g, " "));
      out[key] = val;
    });
  };

  const qIndex = url.indexOf("?");
  if (qIndex >= 0) {
    const afterQ = url.slice(qIndex + 1);
    const beforeHash = afterQ.split("#")[0];
    grab(beforeHash);
  }

  const hIndex = url.indexOf("#");
  if (hIndex >= 0) {
    const afterH = url.slice(hIndex + 1);
    grab(afterH);
  }

  return out;
}

export default function CallbackClient() {
  const router = useRouter();
  const [status, setStatus] = useState("Finishing authentication…");

  useEffect(() => {
    const url = window.location.href;

    async function run() {
      try {
        const params = parseParamsFromUrl(url);

        const errorDesc = params.error_description || params.error;
        if (errorDesc) {
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
          // If we land here without tokens, just send to reset page
          router.replace("/auth/reset");
          return;
        }

        // If it's recovery, we always go to reset
        if (isRecovery) {
          router.replace("/auth/reset");
          return;
        }

        // Otherwise, also go to reset (safe default for our use-case)
        router.replace("/auth/reset");
      } catch {
        router.replace("/auth/reset");
      }
    }

    run();
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center", opacity: 0.9 }}>
        <div style={{ fontSize: 18, marginBottom: 10 }}>{status}</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          If you’re not redirected automatically, go back and open the reset link again.
        </div>
      </div>
    </div>
  );
}
