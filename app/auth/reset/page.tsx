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

function safeRedirectUrlToApp() {
  // Keep this hardcoded + stable.
  // You can change the path later if you want a dedicated "Reset Complete" screen.
  return "neatnotes://auth/callback?type=recovery_done";
}

function tryOpenApp(deepLink: string) {
  // Attempt to open the app (mobile browsers may block automatic navigation).
  // We'll also render a button as a fallback.
  try {
    window.location.href = deepLink;
  } catch {
    // noop
  }
}

export default function ResetPage() {
  const [status, setStatus] = useState<"booting" | "ready" | "done" | "error">("booting");
  const [message, setMessage] = useState<string>("Preparing secure reset…");

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const [deepLink] = useState<string>(() => safeRedirectUrlToApp());
  const [showOpenApp, setShowOpenApp] = useState(false);

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

      // Move into "done" state first so UI updates even if browser blocks deep link.
      setStatus("done");
      setMessage("Password updated. Returning you to Neat Notes…");

      // Attempt auto-open immediately
      tryOpenApp(deepLink);

      // If the browser blocks it, show the fallback button after a beat.
      // (This also covers cases where the app is installed but the OS doesn’t auto-switch.)
      setTimeout(() => setShowOpenApp(true), 650);
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
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid #444",
                background: "transparent",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Confirm new password</span>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              style={{
                padding: 12,
                borderRadius: 8,
                border: "1px solid #444",
                background: "transparent",
              }}
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
            You’ll be sent back to the Neat Notes app after saving.
          </p>
        </div>
      ) : null}

      {status === "done" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ fontSize: 14, opacity: 0.85 }}>
            If Neat Notes didn’t open automatically, tap below:
          </p>

          {showOpenApp ? (
            <a
              href={deepLink}
              style={{
                display: "inline-block",
                padding: 12,
                borderRadius: 10,
                textDecoration: "none",
                textAlign: "center",
                border: "1px solid #444",
              }}
            >
              Open Neat Notes
            </a>
          ) : null}

          <p style={{ fontSize: 12, opacity: 0.75 }}>
            If the button doesn’t work, open Neat Notes manually and sign in with your new password.
          </p>
        </div>
      ) : null}

      {status === "error" ? (
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ fontSize: 13, opacity: 0.85 }}>
            Something prevented a secure reset session from loading.
          </p>
          <p style={{ fontSize: 12, opacity: 0.75 }}>
            Please request a new reset email and open it on this same phone.
          </p>
        </div>
      ) : null}
    </main>
  );
}
