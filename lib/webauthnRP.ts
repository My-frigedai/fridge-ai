// lib/webauthnRP.ts
export function getWebAuthnRP() {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000";

  const url = base.startsWith("http")
    ? new URL(base)
    : new URL(`https://${base}`);

  return {
    origin: url.origin,
    rpID: url.hostname,
  };
}
