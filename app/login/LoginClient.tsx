あなた:
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/app/components/ThemeProvider";
import { motion } from "framer-motion";
import { fadeInUp, springTransition, buttonTap } from "@/app/components/motion";

function base64urlToUint8Array(base64url: string) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const base64Padded = base64 + (pad ? "=".repeat(4 - pad) : "");
  const binary = atob(base64Padded);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64url(bytes: ArrayBuffer | Uint8Array) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < u8.byteLength; i++) binary += String.fromCharCode(u8[i]);
  const base64 = btoa(binary);
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return base64url;
}

function preformatRequestOptions(opts: any) {
  const publicKey: any = { ...opts };
  if (publicKey.challenge && typeof publicKey.challenge === "string") {
    publicKey.challenge = base64urlToUint8Array(publicKey.challenge);
  } else if (Array.isArray(publicKey.challenge)) {
    publicKey.challenge = new Uint8Array(publicKey.challenge);
  }
  if (publicKey.allowCredentials && Array.isArray(publicKey.allowCredentials)) {
    publicKey.allowCredentials = publicKey.allowCredentials.map((c: any) => {
      const out: any = { ...c };
      if (typeof out.id === "string") out.id = base64urlToUint8Array(out.id);
      else if (Array.isArray(out.id)) out.id = new Uint8Array(out.id);
      return out;
    });
  }
  return publicKey;
}

export default function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();
  const registered = search?.get ? search.get("registered") : null;

  const [step, setStep] = useState<"select" | "choose" | "email">("select");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(
    registered ? "登録完了しました。ログインしてください。" : null
  );
  const [loading, setLoading] = useState(false);

  // Theme
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const applied = typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme")
      : null;
    setIsDark(applied ? applied === "dark" : theme === "dark");
  }, [theme]);

  // --------------------------
  // 🔐 パスキーでログイン
  // --------------------------
  const handlePasskeyLogin = async () => {
    setMsg(null);
    setLoading(true);

    try {
      const startRes = await fetch("/api/auth/webauthn/authenticate-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const startJson = await startRes.json();
      if (!startRes.ok || !startJson?.ok) {
        setMsg(startJson?.message || "パスキーの開始に失敗しました。");
        setLoading(false);
        return;
      }

      const publicKey = preformatRequestOptions(startJson.options);

      const assertion: any = (await navigator.credentials.get({ publicKey })) as any;
      if (!assertion) throw new Error("No assertion obtained");

      const authData = {
        id: assertion.id,
        rawId: uint8ArrayToBase64url(assertion.rawId),
        type: assertion.type,
        response: {
          authenticatorData: uint8ArrayToBase64url(assertion.response.authenticatorData),
          clientDataJSON: uint8ArrayToBase64url(assertion.response.clientDataJSON),
          signature: uint8ArrayToBase64url(assertion.response.signature),
          userHandle: assertion.response.userHandle ? uint8ArrayToBase64url(assertion.response.userHandle) : null,
        },
      };

      const verifyRes = await fetch("/api/auth/webauthn/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, assertionResponse: authData }),
      });

      const verifyJson = await verifyRes.json();
      if (!verifyRes.ok || !verifyJson?.ok) {
        setMsg(verifyJson?.message || "パスキー認証に失敗しました。");
        setLoading(false);
        return;
      }

      // server returns one-time token
      const token = verifyJson.token;
      if (!token) {
        setMsg("サーバがトークンを返しませんでした。");
        setLoading(false);
        return;
      }

      // sign in via NextAuth credentials provider using token
      const signInResult: any = await signIn("credentials", {
        redirect: false,
        token,
      });

      if (signInResult?.ok) {
        router.push("/");
      } else {
        setMsg("サーバとの連携に失敗しました（セッションを作成できません）。");
      }
    } catch (err: any) {
      console.error("passkey login error:", err);
      setMsg(err?.message || "パスキーでのログイン処理に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  // --------------------------
  // 🔑 メールアドレス + パスワードログイン
  // --------------------------
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!email) return setMsg("メールアドレスを入力してください");
    if (!password) return setMsg("パスワードを入力してください");

    setLoading(true);
    try {
      const res: any = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (res?.ok) {
        router.push("/");
      } else {
        setMsg("メールアドレスまたはパスワードが正しくありません。");
      }
    } catch (err) {
      console.error(err);
      setMsg("ログイン中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    // Use default redirect-based signIn to ensure OAuth flow works reliably.
    // This will navigate away to Google's consent page and back via NextAuth callbacks.
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (err) {
      console.error("Google signIn error:", err);
      setMsg("外部プロバイダでの認証に失敗しました。");
    }
  };

  return (
    <motion.div
      className="min-h-screen flex items-center justify-start pt-12 pb-8"
      initial="hidden"
      animate="show"
      variants={fadeInUp}
    >
      <div className="w-full max-w-md h-screen mx-auto flex flex-col justify-between items-center -translate-y-6 p-6">
        {/* Logo */}
        <motion.div className="flex flex-col items-center gap-2" initial="hidden" animate="show" variants={fadeInUp}>
          <Image src={isDark ? "/my-fridgeai-logo-white.png" : "/my-fridgeai-logo.png"} alt="My-FridgeAI" width={180} height={52} priority />
          <Image src={isDark ? "/fridge-illustration-dark.png" : "/fridge-illustration.png"} alt="Fridge" width={220} height={130} priority />
          <h2 className="mt-2 text-center text-lg font-semibold text-primary">Welcome to My-FridgeAI</h2>
          <p className="text-center text-sm text-secondary">冷蔵庫の管理を、もっとシンプルに。</p>
        </motion.div>

        {/* Main UI */}
        <div className="w-full">
          {step === "select" ? (
            <div className="flex flex-col gap-3">
              <motion.button
                onClick={() => setStep("choose")}
                className="w-full surface-btn font-semibold py-3 rounded-full border"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                メールアドレス / パスキーでログイン
              </motion.button>

              <motion.button
                onClick={handleGoogle}
                className="w-full surface-btn font-semibold py-3 rounded-full border flex items-center justify-center gap-2"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                {/* Google SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" width="18" height="18" aria-hidden>
                  <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.4H272v95.4h146.9c-6.4 34.6-25.4 63.9-54.2 83.5v68h87.3c51.1-47.1 81-116.4 81-196.5z"/>
                  <path fill="#34A853" d="M272 544.3c73.2 0 134.6-24.3 179.4-65.7l-87.3-68c-24.2 16.2-55.1 26-92.1 26-70.8 0-130.7-47.7-152.2-111.9H27.9v70.9C72.6 486.4 165.5 544.3 272 544.3z"/>
                  <path fill="#FBBC05" d="M119.8 324.7c-10.6-31.6-10.6-65.7 0-97.3v-70.9H27.9c-39.3 77.8-39.3 168.5 0 246.3l90-78.1z"/>
                  <path fill="#EA4335" d="M272 107.7c38.8 0 73.6 13.4 101.2 39.6l75.9-75.9C406.6 24.3 345.2 0 272 0 166.5 0 74.6 60.6 29.8 149.1l90 70.5c21.5-64.2 81.4-111.9 152.2-111.9z"/>
                </svg>
                Googleでログイン
              </motion.button>

              <motion.button
                onClick={() => {}}
                disabled
                className="w-full surface-btn font-semibold py-3 rounded-full border flex items-center justify-center gap-2 disabled:opacity-60"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                {/* Apple icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="18" height="18" fill="currentColor" aria-hidden>
                  <path d="M318.7 268.7c-.2-37.3 16.4-65.7 50-86.2-18.8-27.6-47.2-42.7-86.2-45.5-36.3-2.7-76.2 21.3-90.3 21.3-15 0-50-20.4-77.6-19.8-56.8.8-116.5 46.4-116.5 139.3 0 27.5 5 56.1 15 85.8 13.4 38.7 61.9 133.6 112.3 132 23.9-.5 40.8-16.9 76.3-16.9 34.6 0 50.3 16.9 77.6 16.3 50.8-1 94.7-85.3 107.9-124.2-68.4-32.3-68.5-95-68.5-101.8zM257.5 85.4C282 58.6 293.4 24.1 289 0c-26.6 1.1-57.9 18-76.6 39.2-16.8 19.3-31.6 46.9-27.6 74.4 29.1 2.2 58.9-14.8 72.7-28.2z"/>
                </svg>
                Appleでログイン
              </motion.button>

              <p className="text-xs text-center text-secondary mt-2">
                続行すると
                <Link className="underline ml-1 text-primary" href="/terms">利用規約</Link>
                と
                <Link className="underline ml-1 text-primary" href="/privacy">プライバシーポリシー</Link>
                に同意したことになります。
              </p>

              <p className="text-xs text-center text-muted mt-2">
                アカウントをお持ちでない方は
                <Link className="underline ml-1 text-primary" href="/register">
                  こちらから登録
                </Link>
              </p>
            </div>
          ) : step === "choose" ? (
            <div className="flex flex-col gap-3">
              <motion.button
                onClick={handlePasskeyLogin}
                disabled={loading}
                className="w-full surface-btn font-semibold py-3 rounded-full border"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                パスキーでログイン
              </motion.button>

              <motion.button
                onClick={() => setStep("email")}
                className="w-full surface-btn font-semibold py-3 rounded-full border"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                メールアドレスでログイン
              </motion.button>

              <button type="button" className="w-full mt-2 text-center text-sm underline" onClick={() => setStep("select")}>
                ← 戻る
              </button>
            </div>
          ) : (
            // email login form
            <form onSubmit={handlePasswordLogin} className="flex flex-col gap-3">
              <input
                className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm"
                placeholder="メールアドレス"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="none"
                autoComplete="email"
                required
              />

              <input
                className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm"
                placeholder="パスワード（12文字以上）"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              {msg && <div className="text-sm text-red-600">{msg}</div>}

              <motion.button
                type="submit"
                className="w-full bg-black dark:bg-white dark:text-black text-white font-semibold py-3 rounded-full"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
                disabled={loading}
              >
                {loading ? "確認中…" : "メールアドレスでログイン"}
              </motion.button>

              <div className="flex items-center justify-between mt-2">
                <Link href="/reset-password/request" className="text-sm underline">パスワードをお忘れですか？</Link>
                <button type="button" className="text-sm underline" onClick={() => setStep("select")}>← 戻る</button>
              </div>
            </form>
          )}
        </div>

        <div className="w-full text-center text-xs text-muted mt-2">© My-FridgeAI</div>
      </div>
    </motion.div>
  );
}


// app/api/auth/webauthn/register-options/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateRegistrationOptions } from "@simplewebauthn/server";

/** Helpers -------------------------------------------------------- */

// to Buffer safely from many inputs
function toBuffer(input: unknown): Buffer {
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === "string") {
    // assume it's base64 or base64url or plain id string:
    // if contains '-' or '_' treat as base64url -> convert to base64 first
    if (/[+-_]/.test(input) && /[_-]/.test(input)) {
      // base64url -> base64
      const b64 = (input as string).replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
      return Buffer.from(b64 + pad, "base64");
    }
    // otherwise assume it's base64 already
    try {
      return Buffer.from(input as string, "base64");
    } catch {
      // fallback: encode as utf8 string buffer
      return Buffer.from(String(input), "utf8");
    }
  }
  if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input));
  if (ArrayBuffer.isView(input)) return Buffer.from((input as ArrayBufferView) as any);
  throw new Error("Unsupported input type for toBuffer");
}

// buffer -> base64url (no padding)
function bufferToBase64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// normalize credentialId-like value -> base64url string (safe)
function normalizeToBase64urlString(v: unknown): string {
  if (typeof v === "string") {
    // if already base64url (contains '-' or '_') return as-is
    if (v.includes("-") || v.includes("_")) return v;
    // if looks like base64, convert to base64url
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(v)) {
      return (v as string).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    // otherwise, return raw string (best-effort)
    return v;
  }
  // Buffer/ArrayBuffer/Uint8Array -> base64url
  const buf = toBuffer(v);
  return bufferToBase64url(buf);
}

/** Config --------------------------------------------------------- */
const rpName = "My-FridgeAI";
const rpID = process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, "") || "localhost";

/** Route ---------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email: rawEmail, name } = body ?? {};
    if (!rawEmail) return NextResponse.json({ ok: false, message: "email required" }, { status: 400 });
    const email = String(rawEmail).toLowerCase().trim();

    // ensure user exists
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: name ? String(name) : undefined, status: "active" },
      });
    }

    // Build excludeCredentials as base64url strings (library/runtime accepts strings safely)
    const existingPasskeys = await prisma.passkey.findMany({ where: { userId: user.id } });
    const excludeCredentials = existingPasskeys.map((pk) => ({
      id: normalizeToBase64urlString(pk.credentialId), // string (base64url)
      type: "public-key" as const,
      transports: pk.transports ? JSON.parse(pk.transports) : undefined,
    }));

    // userID: use string form (user.id). We'll pass as string (base64url-like if you prefer)
    // This avoids the Uint8Array vs ArrayBuffer generic mismatch on some type defs.
    const userIdForOptions = String(user.id);

    // Build options object (we cast to any when calling generateRegistrationOptions
    // to avoid brittle TS mismatches across simplewebauthn versions).
    const optsPayload = {
      rpName,
      rpID,
      userID: userIdForOptions,
      userName: email,
      timeout: 60000,
      attestationType: "none",
      authenticatorSelection: {
        userVerification: "preferred",
      },
      excludeCredentials: excludeCredentials.length ? excludeCredentials : undefined,
    };

    // Call the library — cast to any to avoid type-level mismatches across versions.
    // At runtime the library expects IDs/challenge as base64/base64url strings or Uint8Arrays;
    // we supply strings (base64url) which are safe and JSON-serializable for the client.
    const opts = (generateRegistrationOptions as any)(optsPayload);

    // Ensure challenge is a string (if lib gives Uint8Array, convert)
    let challengeStr: string;
    if (typeof opts.challenge === "string") {
      challengeStr = opts.challenge;
    } else if (opts.challenge instanceof Uint8Array || opts.challenge instanceof ArrayBuffer) {
      const buf = toBuffer(opts.challenge);
      challengeStr = bufferToBase64url(buf);
    } else {
      // fallback stringify
      challengeStr = String(opts.challenge);
    }

    // persist challenge (one-time) as base64url string
    await prisma.user.update({ where: { id: user.id }, data: { verifyToken: challengeStr } });

    // Return options to client, but ensure binary fields are strings so JSON is safe.
    const jsonSafeOpts: any = { ...opts, challenge: challengeStr };
    if (jsonSafeOpts.user && (jsonSafeOpts.user.id instanceof Uint8Array || jsonSafeOpts.user.id instanceof ArrayBuffer)) {
      jsonSafeOpts.user = { ...jsonSafeOpts.user, id: bufferToBase64url(toBuffer(jsonSafeOpts.user.id)) };
    } else if (jsonSafeOpts.user && typeof jsonSafeOpts.user.id === "string") {
      // leave as-is
    }

    if (Array.isArray(jsonSafeOpts.excludeCredentials)) {
      jsonSafeOpts.excludeCredentials = jsonSafeOpts.excludeCredentials.map((c: any) => {
        let id = c.id;
        if (id instanceof Uint8Array || id instanceof ArrayBuffer) id = bufferToBase64url(toBuffer(id));
        // ensure final id is a string (base64url)
        id = normalizeToBase64urlString(id);
        return { ...c, id };
      });
    }

    return NextResponse.json({ ok: true, options: jsonSafeOpts });
  } catch (err: any) {
    console.error("webauthn register-options error:", err);
    return NextResponse.json({ ok: false, message: "server error" }, { status: 500 });
  }
}