"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";

function parseHashParams() {
  // Example:
  // #access_token=...&refresh_token=...&type=recovery
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;

  const out: Record<string, string> = {};
  for (const part of raw.split("&")) {
    if (!part) continue;
    const idx = part.indexOf("=");
    const k = idx >= 0 ? part.slice(0, idx) : part;
    const v = idx >= 0 ? part.slice(idx + 1) : "";
    if (!k) continue;
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

export default function ResetPage() {
  const [status, setStatus] = useState<"booting" | "ready" | "error">("booting");
  const [message, setMessage] = useState<string>("Preparing secure reset…");

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const passwordsOk = useMemo(() => {
    if (pw1.trim().length < 8) return false;
    if (pw1 !== pw2) return false;
    return true;
  }, [pw1, pw2]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const params = parseHashParams();
        const access_token = params.access_token;
        const refresh_token = params.refresh_token;
        const type = (params.type || "").toLowerCase();

        if (!access_token || !refresh_token) {
          setStatus("error");
          setMessage(
            "Missing reset tokens. Please request a new reset email and open the link on this device."
          );
          return;
        }

        if (type && type !== "recovery") {
          // Not fatal, but good to know.
          console.log("Reset page opened with type =", type);
        }

        setMessage("Restoring secure session…");

        const { error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error) throw error;

        const { data } = await supabase.auth.getSession();
        const ok = !!data.session?.user;

        if (cancelled) return;

        if (!ok) {
          setStatus("error");
          setMessage(
            "Could not establish a reset session. Please request a new reset email and try again."
          );
          return;
        }

        setStatus("ready");
        setMessage("Session ready. Set a new password.");
      } catch (e: any) {
        if (cancelled) return;
        setStatus("error");
        setMessage(String(e?.message ?? e));
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave() {
    if (busy) return;

    if (!passwordsOk) {
      alert("Passwords must match and be at least 8 characters.");
      return;
    }

    try {
      setBusy(true);
      const { error } = await supabase.auth.updateUser({ password: pw1.trim() });
      if (error) throw error;

      alert("Password updated. You can return to the app and sign in.");
      // Optional: you can redirect to a simple success page later.
    } catch (e: any) {
      alert(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "48px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Reset Password</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>{message}</p>

      {status === "ready" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>New password</span>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder="At least 8 characters"
              style={{ padding: 12, borderRadius: 8, border: "1px solid #444", background: "transparent" }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Confirm new password</span>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              style={{ padding: 12, borderRadius: 8, border: "1px solid #444", background: "transparent" }}
            />
          </label>

          <button
            onClick={onSave}
            disabled={busy || !passwordsOk}
            style={{
              padding: 12,
              borderRadius: 10,
              border: "0",
              cursor: busy || !passwordsOk ? "not-allowed" : "pointer",
              opacity: busy || !passwordsOk ? 0.6 : 1,
            }}
          >
            {busy ? "Saving…" : "Save Password"}
          </button>

          <p style={{ fontSize: 12, opacity: 0.75 }}>
            After saving, return to the Neat Notes app and sign in with your new password.
          </p>
        </div>
      ) : null}
    </main>
  );
}
