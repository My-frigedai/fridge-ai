// app/login/LoginClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/app/components/ThemeProvider";
import { motion } from "framer-motion";
import { fadeInUp, springTransition, buttonTap } from "@/app/components/motion";

/**
 * Helpers: base64url <-> Uint8Array
 */
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
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Convert server-provided authenticate options into navigator-friendly publicKey
 * Defensive: supports base64url strings or arrays.
 */
function preformatRequestOptions(opts: any) {
  if (!opts) throw new Error("No authenticate options from server");
  // server may wrap with { publicKey: { ... } } or return object directly
  const publicKey: any = { ...(opts.publicKey ?? opts) };

  // challenge
  if (publicKey.challenge) {
    if (typeof publicKey.challenge === "string") {
      publicKey.challenge = base64urlToUint8Array(publicKey.challenge);
    } else if (Array.isArray(publicKey.challenge)) {
      publicKey.challenge = new Uint8Array(publicKey.challenge);
    }
  } else {
    throw new Error("Authenticate options missing challenge");
  }

  // allowCredentials
  if (Array.isArray(publicKey.allowCredentials)) {
    publicKey.allowCredentials = publicKey.allowCredentials.map((c: any) => {
      const out = { ...c };
      if (typeof out.id === "string") out.id = base64urlToUint8Array(out.id);
      else if (Array.isArray(out.id)) out.id = new Uint8Array(out.id);
      return out;
    });
  }

  return publicKey;
}

/**
 * Serialize a navigator.credentials.get() assertion for server
 */
function serializeAssertion(assertion: any) {
  return {
    id: assertion.id,
    rawId: uint8ArrayToBase64url(assertion.rawId),
    type: assertion.type,
    response: {
      authenticatorData: uint8ArrayToBase64url(
        assertion.response.authenticatorData,
      ),
      clientDataJSON: uint8ArrayToBase64url(assertion.response.clientDataJSON),
      signature: uint8ArrayToBase64url(assertion.response.signature),
      userHandle: assertion.response.userHandle
        ? uint8ArrayToBase64url(assertion.response.userHandle)
        : null,
    },
  };
}

export default function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();
  const registered = search?.get ? search.get("registered") : null;

  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // UI state
  const [step, setStep] = useState<"select" | "email">("select");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(
    registered ? "登録完了しました。ログインしてください。" : null,
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Minor spacing / layout: keep visual similar but avoid huge gaps
  // (No global layout changes — only local spacing fixes)
  useEffect(() => {
    // reset messages when switching steps to avoid stale messages
    setMsg((m) => {
      if (!m) return m;
      return m;
    });
  }, [step]);

  // ---------- Passkey login ----------
  const handlePasskeyLogin = async () => {
    setMsg(null);
    setLoading(true);
    try {
      if (!email) {
        setMsg("パスキーでログインするにはメールアドレスを入力してください。");
        return;
      }

      // 1) request options
      const startRes = await fetch("/api/auth/webauthn/authenticate-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      let startJson: any = {};
      try {
        startJson = await startRes.json();
      } catch (e) {
        // malformed JSON
        console.error("[passkey] authenticate-options JSON parse failed:", e);
      }
      if (!startRes.ok || !startJson?.ok) {
        // friendly handling for known server messages (no passkeys etc.)
        const serverMsg =
          startJson?.message ??
          (startRes.status
            ? `サーバーエラー（${startRes.status}）`
            : "サーバー通信に失敗しました");
        if (
          serverMsg.includes("no passkeys") ||
          serverMsg.includes("No passkeys")
        ) {
          setMsg(
            "このアドレスではパスキーが登録されていません。メール/パスワードでログインしてください。",
          );
        } else if (
          serverMsg.includes("no such user") ||
          serverMsg.includes("no user")
        ) {
          setMsg("そのメールアドレスは未登録です。新規登録してください。");
        } else {
          setMsg(serverMsg);
        }
        return;
      }

      const publicKey = preformatRequestOptions(startJson.options);
      // 2) call WebAuthn API
      if (!("credentials" in navigator)) {
        setMsg(
          "ブラウザがWebAuthnに対応していません。別の方法でログインしてください。",
        );
        return;
      }

      const assertion: any = (await navigator.credentials.get({
        publicKey,
      } as any)) as any;
      if (!assertion) {
        setMsg("認証がキャンセルされました。もう一度お試しください。");
        return;
      }

      // 3) serialize and send to server
      const serialized = serializeAssertion(assertion);
      const verifyRes = await fetch("/api/auth/webauthn/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, assertionResponse: serialized }),
      });
      let verifyJson: any = {};
      try {
        verifyJson = await verifyRes.json();
      } catch (e) {
        console.error("[passkey] authenticate response JSON parse failed:", e);
      }
      if (!verifyRes.ok || !verifyJson?.ok) {
        const serverMsg =
          verifyJson?.message ??
          (verifyRes.status
            ? `認証に失敗しました（${verifyRes.status}）`
            : "認証に失敗しました");
        setMsg(serverMsg);
        return;
      }

      // server should return a one-time token to use with credentials provider
      const token = verifyJson.token;
      if (!token) {
        console.error("[passkey] server did not return a token:", verifyJson);
        setMsg("認証に失敗しました（トークンがありません）。");
        return;
      }

      // 4) sign in with one-time token via credentials provider
      const sres: any = await signIn("credentials", {
        redirect: false,
        token,
        callbackUrl: "/",
      });
      if (sres?.ok) {
        // success -> go home
        router.replace("/");
      } else {
        // fallback: go to login page with registered flag
        router.replace("/login?registered=1");
      }
    } catch (err: any) {
      console.error("[passkey login] error:", err);
      const friendly =
        err?.message || "パスキーログイン中にエラーが発生しました。";
      setMsg(friendly);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Email + Password login ----------
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!email) return setMsg("メールアドレスを入力してください。");
    if (!password) return setMsg("パスワードを入力してください。");

    setLoading(true);
    try {
      // use credentials provider (email/password)
      const res: any = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl: "/",
      });

      if (res?.ok) {
        router.replace("/");
      } else {
        // NextAuth may return error field
        const errMsg =
          res?.error ?? "メールアドレスまたはパスワードが正しくありません。";
        setMsg(errMsg);
      }
    } catch (err: any) {
      console.error("[password login] error:", err);
      setMsg("ログイン中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Google OAuth ----------
  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signIn("google", { callbackUrl: "/" });
      // signIn will redirect in most configurations
    } catch (err) {
      console.error("[google login] error:", err);
      setMsg("Google認証に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  // Accessibility: polite live region for messages
  const Message = () =>
    msg ? (
      <div
        className="text-sm text-center text-red-600 mt-2"
        role="status"
        aria-live="polite"
      >
        {msg}
      </div>
    ) : null;

  return (
    <motion.div
      className="min-h-screen flex items-center justify-start pt-12 pb-8"
      initial="hidden"
      animate="show"
      variants={fadeInUp}
    >
      <div className="w-full max-w-md h-screen mx-auto flex flex-col justify-center items-center p-6">
        {/* header */}
        <div className="flex flex-col items-center gap-2">
          {mounted ? (
            <Image
              src={
                theme === "dark"
                  ? "/my-fridgeai-logo-white.png"
                  : "/my-fridgeai-logo.png"
              }
              alt="My-FridgeAI"
              width={180}
              height={52}
              priority
            />
          ) : (
            <div style={{ width: 180, height: 52 }} />
          )}

          {mounted ? (
            <Image
              src={
                theme === "dark"
                  ? "/fridge-illustration-dark.png"
                  : "/fridge-illustration.png"
              }
              alt="Fridge"
              width={220}
              height={130}
              priority
              style={{ objectFit: "contain" }}
            />
          ) : (
            <div style={{ width: 220, height: 130 }} />
          )}

          <h2 className="mt-2 text-center text-lg font-semibold text-primary">
            Welcome to My-FridgeAI
          </h2>
          <p className="text-center text-sm text-secondary">
            冷蔵庫の管理を、もっとシンプルに。
          </p>
        </div>

        {/* main */}
        <div className="w-full mt-4">
          {step === "select" ? (
            <div className="flex flex-col gap-3">
              <motion.button
                onClick={() => {
                  setStep("email");
                  setMsg(null);
                }}
                disabled={loading}
                className="w-full surface-btn font-semibold py-3 rounded-full flex items-center justify-center gap-2 transition transform duration-150 ease-out active:translate-y-1 disabled:opacity-60"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                メールアドレス / パスキーでログイン
              </motion.button>

              <motion.button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full surface-btn font-semibold py-3 rounded-full flex items-center justify-center gap-2 transition transform duration-150 ease-out active:translate-y-1 disabled:opacity-60"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                {/* Google SVG */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 533.5 544.3"
                  width="18"
                  height="18"
                  aria-hidden
                >
                  <path
                    fill="#4285F4"
                    d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.4H272v95.4h146.9c-6.4 34.6-25.4 63.9-54.2 83.5v68h87.3c51.1-47.1 81-116.4 81-196.5z"
                  />
                  <path
                    fill="#34A853"
                    d="M272 544.3c73.2 0 134.6-24.3 179.4-65.7l-87.3-68c-24.2 16.2-55.1 26-92.1 26-70.8 0-130.7-47.7-152.2-111.9H27.9v70.9C72.6 486.4 165.5 544.3 272 544.3z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M119.8 324.7c-10.6-31.6-10.6-65.7 0-97.3v-70.9H27.9c-39.3 77.8-39.3 168.5 0 246.3l90-78.1z"
                  />
                  <path
                    fill="#EA4335"
                    d="M272 107.7c38.8 0 73.6 13.4 101.2 39.6l75.9-75.9C406.6 24.3 345.2 0 272 0 166.5 0 74.6 60.6 29.8 149.1l90 70.5c21.5-64.2 81.4-111.9 152.2-111.9z"
                  />
                </svg>
                Googleでログイン
              </motion.button>

              <motion.button
                onClick={() => alert("Appleログインは後日実装します")}
                disabled
                className="w-full surface-btn font-semibold py-3 rounded-full border flex items-center justify-center gap-2 disabled:opacity-60"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                {/* Apple SVG */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 384 512"
                  width="18"
                  height="18"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M318.7 268.7c-.2-37.3 16.4-65.7 50-86.2-18.8-27.6-47.2-42.7-86.2-45.5-36.3-2.7-76.2 21.3-90.3 21.3-15 0-50-20.4-77.6-19.8-56.8.8-116.5 46.4-116.5 139.3 0 27.5 5 56.1 15 85.8 13.4 38.7 61.9 133.6 112.3 132 23.9-.5 40.8-16.9 76.3-16.9 34.6 0 50.3 16.9 77.6 16.3 50.8-1 94.7-85.3 107.9-124.2zM257.5 85.4C282 58.6 293.4 24.1 289 0c-26.6 1.1-57.9 18-76.6 39.2-16.8 19.3-31.6 46.9-27.6 74.4 29.1 2.2 58.9-14.8 72.7-28.2z" />
                </svg>
                Appleでログイン
              </motion.button>

              <p className="text-xs text-center text-secondary mt-2">
                続行すると
                <Link className="underline ml-1 text-primary" href="/terms">
                  利用規約
                </Link>
                と
                <Link className="underline ml-1 text-primary" href="/privacy">
                  プライバシーポリシー
                </Link>
                に同意したことになります。
              </p>

              <p className="text-xs text-center text-muted mt-2">
                アカウントをお持ちでない方は
                <Link className="underline ml-1 text-primary" href="/register">
                  こちらから登録
                </Link>
              </p>
            </div>
          ) : (
            // email step (contains both passkey & password flows)
            <form
              onSubmit={handlePasswordLogin}
              className="flex flex-col gap-3"
            >
              <input
                className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm"
                placeholder="メールアドレス"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />

              {/* Password field (only used for password-flow) */}
              <div className="relative">
                <input
                  className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 pr-10 text-sm"
                  placeholder="パスワード"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  aria-label={
                    showPassword ? "パスワードを隠す" : "パスワードを表示する"
                  }
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-2/4 -translate-y-2/4 p-1"
                >
                  {/* Single consistent eye icon; simple stroke-based SVG to avoid clipping */}
                  {showPassword ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M3 3l18 18"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M10.58 10.58A3 3 0 0 0 13.42 13.42"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2 12s4-7 10-7c2.01 0 3.87.5 5.5 1.34"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Passkey login button */}
              <motion.button
                type="button"
                onClick={handlePasskeyLogin}
                disabled={loading}
                className="w-full bg-white border rounded-full py-3 text-sm"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
                style={{ color: "var(--color-passkey-text)" }}
              >
                パスキーでログイン
              </motion.button>

              <Message />

              {/* Password login */}
              <motion.button
                type="submit"
                disabled={loading}
                className="w-full bg-black dark:bg-white dark:text-black text-white font-semibold py-3 rounded-full"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                {loading ? "確認中…" : "メールアドレス・パスワードでログイン"}
              </motion.button>

              <div className="flex items-center justify-between mt-2">
                <Link
                  href="/reset-password/request"
                  className="text-sm underline"
                >
                  パスワードをお忘れですか？
                </Link>
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => setStep("select")}
                >
                  ← 戻る
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="w-full text-center text-xs text-muted mt-4">
          © My-FridgeAI
        </div>
      </div>
    </motion.div>
  );
}
