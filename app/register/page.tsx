// app/register/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/components/ThemeProvider";
import { fadeInUp, springTransition, buttonTap } from "@/app/components/motion";

/**
 * Register Page (client)
 *
 * Flow:
 * 1) User fills name/email/password
 * 2) POST /api/auth/set-password で user を作成（password をハッシュして保存する server 側処理想定）
 * 3) call signIn("email", { email, redirect:false, callbackUrl: "/passkey-setup" }) to send magic link
 * 4) show friendly message: "確認メールを送信しました"
 */

export default function RegisterPageClient() {
  const router = useRouter();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // visibility toggles (per-field, robust)
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // UI state
  const [step, setStep] = useState<"select" | "form">("select");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(
    null,
  );

  // small validators
  function validateEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  async function savePassword() {
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    // 成功時
    if (res.ok) {
      return true;
    }

    // ---- 失敗時（ここが重要） ----
    let payload: any = null;

    try {
      payload = await res.json();
    } catch {
      // JSONで返らないケースにも耐える
      payload = null;
    }

    // ① 既に登録済みユーザー
    if (res.status === 409) {
      throw new Error(
        payload?.message ??
          "このメールアドレスは既に登録されています。ログインするか、パスワードをリセットしてください。",
      );
    }

    // ② 入力不正（400）
    if (res.status === 400) {
      throw new Error(
        payload?.message ??
          "入力内容に誤りがあります。もう一度確認してください。",
      );
    }

    // ③ その他（500 など）
    throw new Error(
      payload?.message ?? `ユーザー作成に失敗しました（${res.status}）`,
    );
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setMsg(null);

    // basic validation
    if (!validateEmail(email)) {
      setMsg({
        type: "error",
        text: "有効なメールアドレスを入力してください。",
      });
      return;
    }
    if (password.length < 8) {
      setMsg({ type: "error", text: "パスワードは8文字以上にしてください。" });
      return;
    }
    if (password !== confirmPassword) {
      setMsg({ type: "error", text: "パスワード確認が一致しません。" });
      return;
    }

    setLoading(true);
    try {
      // 1) create user record and hash password on server
      await savePassword();

      // 2) send magic link via NextAuth EmailProvider that will redirect to /passkey-setup on click
      const res: any = await signIn("email", {
        email,
        redirect: false,
        callbackUrl: "/passkey-setup",
      });

      if (res?.error) {
        console.warn("[email signIn] error res:", res);
        setMsg({
          type: "error",
          text: "確認メール送信に失敗しました。メール設定を確認してください。",
        });
        return;
      }

      setMsg({
        type: "ok",
        text: "確認メールを送信しました。メール内のリンクをクリックして登録を完了してください（リンクは数分で届きます）。",
      });
      // show passkey info and next steps (do not redirect automatically)
    } catch (err: any) {
      console.error("register error:", err);
      setMsg({
        type: "error",
        text: err?.message || "アカウント作成に失敗しました。",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (err) {
      console.error("[google signup] error:", err);
      setMsg({ type: "error", text: "Googleでの登録に失敗しました。" });
    } finally {
      setLoading(false);
    }
  };

  const handleApple = () => {
    alert("Apple登録は未実装（後で対応予定）");
  };

  return (
    <motion.div
      className="min-h-screen flex items-center justify-start pt-10 pb-8"
      initial="hidden"
      animate="show"
      variants={fadeInUp}
    >
      <div className="w-full max-w-md h-screen mx-auto flex flex-col justify-between items-center -translate-y-6 p-6">
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
              style={{ objectFit: "contain" }}
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
              alt="Fridge illustration"
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
          <p className="text-center text-secondary mt-0">
            日常の食材管理を、もっとスマートに。
          </p>
        </div>

        <div className="w-full">
          {step === "select" ? (
            <div className="flex flex-col gap-3">
              <motion.button
                onClick={() => setStep("form")}
                disabled={loading}
                className="w-full surface-btn font-semibold py-3 rounded-full flex items-center justify-center gap-2"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                メールアドレスで新規登録
              </motion.button>

              <motion.button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full surface-btn font-semibold py-3 rounded-full flex items-center justify-center gap-2"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                {/* Google SVG (official colors) */}
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
                Googleで新規登録
              </motion.button>

              <motion.button
                onClick={handleApple}
                disabled
                className="w-full surface-btn font-semibold py-3 rounded-full border flex items-center justify-center gap-2 disabled:opacity-60"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 384 512"
                  width="18"
                  height="18"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M318.7 268.7c-.2-37.3 16.4-65.7 50-86.2-18.8-27.6-47.2-42.7-86.2-45.5-36.3-2.7-76.2 21.3-90.3 21.3-15 0-50-20.4-77.6-19.8-56.8.8-116.5 46.4-116.5 139.3 0 27.5 5 56.1 15 85.8 13.4 38.7 61.9 133.6 112.3 132 23.9-.5 40.8-16.9 76.3-16.9 34.6 0 50.3 16.9 77.6 16.3 50.8-1 94.7-85.3 107.9-124.2-68.4-32.3-68.5-95-68.5-101.8zM257.5 85.4C282 58.6 293.4 24.1 289 0c-26.6 1.1-57.9 18-76.6 39.2-16.8 19.3-31.6 46.9-27.6 74.4 29.1 2.2 58.9-14.8 72.7-28.2z" />
                </svg>
                Appleで新規登録
              </motion.button>

              <p className="text-xs text-center text-secondary mt-2">
                続行すると
                <a href="/terms" className="underline ml-1 text-primary">
                  利用規約
                </a>
                と
                <a href="/privacy" className="underline ml-1 text-primary">
                  プライバシーポリシー
                </a>
                に同意したことになります。
              </p>

              <p className="text-xs text-center text-muted mt-2">
                すでにアカウントをお持ちですか？
                <a href="/login" className="underline ml-1 text-primary">
                  ログイン
                </a>
              </p>
            </div>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm"
                placeholder="表示名（任意）"
              />

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm"
                placeholder="メールアドレス"
                type="email"
                autoComplete="email"
              />

              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 pr-10 text-sm"
                  placeholder="パスワード（8文字以上）"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-2/4 -translate-y-2/4 p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    /* eye open icon */
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      />
                    </svg>
                  ) : (
                    /* eye closed icon */
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
                        strokeWidth="1.2"
                      />
                    </svg>
                  )}
                </button>
              </div>

              <div className="relative">
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 pr-10 text-sm"
                  placeholder="パスワード（確認）"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-2 top-2/4 -translate-y-2/4 p-1"
                  aria-label={
                    showConfirm
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  {showConfirm ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5z"
                        stroke="currentColor"
                        strokeWidth="1.2"
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
                        strokeWidth="1.2"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {msg && (
                <div
                  className={`text-sm ${msg.type === "error" ? "text-red-600" : "text-green-700"}`}
                >
                  {msg.text}
                </div>
              )}

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full bg-black dark:bg-white dark:text-black text-white font-semibold py-3 rounded-full"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                {loading ? "処理中…" : "アカウントを作成して確認メールを送信"}
              </motion.button>

              <button
                type="button"
                className="w-full mt-2 text-center text-sm underline"
                onClick={() => setStep("select")}
                disabled={loading}
              >
                ← 戻る
              </button>
            </form>
          )}
        </div>

        <div className="w-full text-center text-xs text-muted mt-2">
          © My-FridgeAI
        </div>
      </div>
    </motion.div>
  );
}
