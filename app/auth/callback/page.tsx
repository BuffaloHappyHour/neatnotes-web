export const dynamic = "force-dynamic";
export const revalidate = 0;

"use client";

import { useEffect, useState } from "react";

function getHashAndQuery(url: string) {
  // Returns { hash: "a=b&c=d", query: "x=y" }
  const out = { hash: "", query: "" };

  const qIndex = url.indexOf("?");
  if (qIndex >= 0) {
    const afterQ = url.slice(qIndex + 1);
    out.query = afterQ.split("#")[0] ?? "";
  }

  const hIndex = url.indexOf("#");
  if (hIndex >= 0) out.hash = url.slice(hIndex + 1) ?? "";

  return out;
}

export default function AuthCallbackPage() {
  const [msg, setMsg] = useState("Finishing sign-in…");

  useEffect(() => {
    try {
      // We don’t do any Supabase work here.
      // This page only exists so email links never crash build,
      // and we can forward recovery flows to /auth/reset.
      const href = window.location.href;
      const { hash } = getHashAndQuery(href);

      // If this is a recovery link, forward the full hash to /auth/reset
      // (Supabase puts tokens in the hash fragment)
      if (hash && hash.toLowerCase().includes("type=recovery")) {
        window.location.replace(`/auth/reset#${hash}`);
        return;
      }

      // Otherwise, just go home (or you can change this later)
      window.location.replace("/");
    } catch {
      // If anything weird happens, just go home.
      window.location.replace("/");
    }
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 8 }}>Neat Notes</h1>
      <p style={{ opacity: 0.8 }}>{msg}</p>
    </main>
  );
}
