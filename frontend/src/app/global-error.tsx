"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f6f7f9", color: "#101828" }}>
        <div role="alert" style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>RouteZen ran into a problem</h1>
          <p style={{ color: "#667085" }}>{error.message || "Unexpected error."}</p>
          <button type="button" onClick={reset} style={{ background: "#FFC629", border: 0, borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
