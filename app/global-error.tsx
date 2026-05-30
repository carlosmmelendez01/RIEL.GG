"use client";

/**
 * Root error boundary. Renders when even the root layout fails — has to ship
 * its own <html>/<body> because no layout is available.
 *
 * Kept deliberately minimal: zero dependencies on shared components, no
 * client-side libs, no fancy CSS. Just enough to give the user a recovery
 * path and a reference number for support.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error("[global-error]", error.message, { digest: error.digest });
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#050608",
          color: "#f8fafc",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              border: "1px solid rgba(225, 29, 72, 0.4)",
              background: "rgba(225, 29, 72, 0.1)",
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
            }}
          >
            ⚡
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 600, marginTop: 24, letterSpacing: "-0.02em" }}>
            RIEL.GG hit a snag.
          </h1>
          <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: "#94a3b8" }}>
            We&apos;ve logged the issue automatically. You can try again here, or email{" "}
            <a href="mailto:support@riel.gg" style={{ color: "#f8fafc", textDecoration: "underline" }}>
              support@riel.gg
            </a>{" "}
            with the reference below and we&apos;ll get you sorted.
          </p>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "#e11d48",
                color: "white",
                border: 0,
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                background: "transparent",
                color: "#f8fafc",
                border: "1px solid #222631",
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Go home
            </a>
          </div>

          {error.digest ? (
            <p
              style={{
                marginTop: 24,
                fontFamily: "ui-monospace, monospace",
                fontSize: 10,
                color: "#94a3b8",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Reference · {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
