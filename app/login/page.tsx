// app/login/page.tsx
'use client';

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "@/app/components/ThemeProvider";
import { motion } from "framer-motion";
import { fadeInUp, springTransition, buttonTap } from "@/app/components/motion";

export default function LoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const registered = search?.get("registered");
  const [step, setStep] = useState<"select" | "email" | "otp">("select");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState<string | null>(
    registered ? "登録完了しました。ログインしてください。" : null
  );
  const [loading, setLoading] = useState(false);

  // Theme
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const applied = typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null;
    setIsDark(applied ? applied === "dark" : theme === "dark");
  }, [theme]);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const res = await signIn("google", { callbackUrl: "/", redirect: false });
      if (!(res as any)?.ok) {
        setMsg("ログインに失敗しました。");
      }
    } catch (err) {
      console.error(err);
      setMsg("ログインに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setMsg("現在準備中です。");
  };

  // メール+パスワードを送って OTP を生成・送信させる
  const handlePasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMsg("メールアドレスを入力してください");
      return;
    }
    if (!password) {
      setMsg("パスワードを入力してください");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, mode: "login", password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.message || "サーバーエラーが発生しました。");
        return;
      }

      // OTP 送信成功 → OTP 入力ステップへ
      setStep("otp");
      setMsg("確認コードを送信しました。メールを確認してください。");
    } catch (err) {
      console.error("send-otp request error:", err);
      setMsg("サーバーエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  // OTP 検証を行い、成功したら credentials で signIn
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!otp) {
      setMsg("確認コードを入力してください");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), mode: "login", code: otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.message || "確認に失敗しました。");
        return;
      }

      // OTP 検証成功 → 実際に credentials で signIn（password はクライアントに保持している）
      const signInRes = await signIn("credentials", { redirect: false, email: email.trim(), password });
      if ((signInRes as any)?.ok) {
        router.push("/");
      } else {
        setMsg("メールアドレスまたはパスワードが一致しません");
      }
    } catch (err) {
      console.error("verify-otp request error:", err);
      setMsg("サーバーエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), mode: "login", password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.message || "再送信に失敗しました。");
        return;
      }
      setMsg("確認コードを再送しました。");
    } catch (err) {
      console.error("resend error:", err);
      setMsg("サーバーエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="min-h-screen flex items-center justify-start pt-12 pb-8 transition-colors duration-300" initial="hidden" animate="show" variants={fadeInUp}>
      <div className="w-full max-w-md h-screen mx-auto flex flex-col justify-between items-center -translate-y-6 p-6">
        <motion.div className="flex flex-col items-center gap-2" initial="hidden" animate="show" variants={fadeInUp}>
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <Image
              src={isDark ? "/my-fridgeai-logo-white.png" : "/my-fridgeai-logo.png"}
              alt="My-fridgeai"
              width={180}
              height={52}
              priority
            />
          </motion.div>

          <motion.div className="mt-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.08 }}>
            <Image
              src={isDark ? "/fridge-illustration-dark.png" : "/fridge-illustration.png"}
              alt="Fridge"
              width={220}
              height={130}
              priority
            />
          </motion.div>

          <h2 className="mt-2 text-center text-lg font-semibold text-primary">Welcome to My-FridgeAI</h2>
          <p className="text-center text-sm text-secondary">冷蔵庫の管理を、もっとシンプルに。</p>
        </motion.div>

        <div className="w-full">
          {step === "select" ? (
            <div className="flex flex-col gap-3">
              <motion.button
                onClick={() => setStep("email")}
                className="w-full surface-btn font-semibold py-3 rounded-full border flex items-center justify-center gap-2 transition transform duration-150 ease-out active:translate-y-1 active:brightness-95 focus:outline-none"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
                aria-busy={loading}
              >
                メールアドレスでログイン
              </motion.button>

              <motion.button
                onClick={handleGoogle}
                className="w-full surface-btn font-semibold py-3 rounded-full border flex items-center justify-center gap-2 transition transform duration-150 ease-out active:translate-y-1 active:brightness-95 focus:outline-none"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
                aria-busy={loading}
              >
                {/* Google SVG（4色） */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" width="18" height="18" aria-hidden="true" focusable="false">
                  <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.4H272v95.4h146.9c-6.4 34.6-25.4 63.9-54.2 83.5v68h87.3c51.1-47.1 81-116.4 81-196.5z"/>
                  <path fill="#34A853" d="M272 544.3c73.2 0 134.6-24.3 179.4-65.7l-87.3-68c-24.2 16.2-55.1 26-92.1 26-70.8 0-130.7-47.7-152.2-111.9H27.9v70.9C72.6 486.4 165.5 544.3 272 544.3z"/>
                  <path fill="#FBBC05" d="M119.8 324.7c-10.6-31.6-10.6-65.7 0-97.3v-70.9H27.9c-39.3 77.8-39.3 168.5 0 246.3l90-78.1z"/>
                  <path fill="#EA4335" d="M272 107.7c38.8 0 73.6 13.4 101.2 39.6l75.9-75.9C406.6 24.3 345.2 0 272 0 166.5 0 74.6 60.6 29.8 149.1l90 70.5c21.5-64.2 81.4-111.9 152.2-111.9z"/>
                </svg>
                Googleでログイン
              </motion.button>

              <motion.button
                onClick={handleApple}
                disabled
                className="w-full surface-btn font-semibold py-3 rounded-full border flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition transform duration-150 ease-out"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false">
                  <path d="M318.7 268.7c-.2-37.3 16.4-65.7 50-86.2-18.8-27.6-47.2-42.7-86.2-45.5-36.3-2.7-76.2 21.3-90.3 21.3-15 0-50-20.4-77.6-19.8-56.8.8-116.5 46.4-116.5 139.3 0 27.5 5 56.1 15 85.8 13.4 38.7 61.9 133.6 112.3 132 23.9-.5 40.8-16.9 76.3-16.9 34.6 0 50.3 16.9 77.6 16.3 50.8-1 94.7-85.3 107.9-124.2-68.4-32.3-68.5-95-68.5-101.8zM257.5 85.4C282 58.6 293.4 24.1 289 0c-26.6 1.1-57.9 18-76.6 39.2-16.8 19.3-31.6 46.9-27.6 74.4 29.1 2.2 58.9-14.8 72.7-28.2z"/>
                </svg>
                Appleでログイン（近日実装予定）
              </motion.button>

              <p className="text-xs text-center text-secondary mt-2">
                続行すると、
                <Link href="/terms" className="underline ml-1 text-primary">利用規約</Link>
                と
                <Link href="/privacy" className="underline ml-1 text-primary">プライバシーポリシー</Link>
                に同意したことになります。
              </p>

              <p className="text-xs text-center text-muted mt-2">
                アカウントをお持ちでない方は
                <Link href="/register" className="underline ml-1 text-primary">こちらから登録</Link>
              </p>
            </div>
          ) : step === "email" ? (
            <form onSubmit={handlePasswordLogin} className="flex flex-col gap-3">
              <input
                className="w-full bg-white dark:bg-gray-800 rounded-lg border border-black dark:border-gray-600 px-3 py-2 text-sm focus:outline-none dark:text-gray-100"
                placeholder="メールアドレス"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="none"
              />

              <input
                className="w-full bg-white dark:bg-gray-800 rounded-lg border border-black dark:border-gray-600 px-3 py-2 text-sm focus:outline-none dark:text-gray-100"
                placeholder="パスワード"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {msg && <div className="text-sm text-red-600" role="alert">{msg}</div>}

              <motion.button
                type="submit"
                className="w-full bg-black dark:bg-white dark:text-black text-white font-semibold py-3 rounded-full transition transform duration-150 ease-out active:translate-y-1 active:brightness-95"
                disabled={loading}
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
                aria-busy={loading}
              >
                {loading ? "確認中…" : "認証コードを送信する"}
              </motion.button>

              <div className="flex items-center justify-between mt-2">
                <Link href="/reset-password/request" className="text-sm underline">パスワードをお忘れですか？</Link>
                <button type="button" className="text-sm underline" onClick={() => setStep("select")}>← 戻る</button>
              </div>
            </form>
          ) : (
            // OTP 入力ステップ
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-3">
              <p className="text-sm text-secondary">メールに届いた 6 桁のコードを入力してください。</p>

              <input
                className="w-full bg-white dark:bg-gray-800 rounded-lg border border-black dark:border-gray-600 px-3 py-2 text-sm focus:outline-none tracking-widest text-center dark:text-gray-100"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                aria-label="確認コード"
              />

              {msg && <div className="text-sm text-red-600" role="alert">{msg}</div>}

              <motion.button
                type="submit"
                className="w-full bg-black dark:bg-white dark:text-black text-white font-semibold py-3 rounded-full transition transform duration-150 ease-out active:translate-y-1 active:brightness-95"
                disabled={loading}
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
                aria-busy={loading}
              >
                {loading ? "検証中…" : "コードを確認してログイン"}
              </motion.button>

              <div className="flex gap-3">
                <motion.button type="button" className="w-1/2 bg-white dark:bg-gray-800 rounded-full border dark:border-gray-600 py-2 text-sm dark:text-gray-100" onClick={handleResend} disabled={loading} whileTap={buttonTap.whileTap} transition={springTransition}>
                  コードを再送
                </motion.button>
                <button type="button" className="w-1/2 text-sm underline" onClick={() => setStep("email")} disabled={loading}>
                  ← 戻る
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="w-full text-center text-xs text-muted mt-2">© My-FridgeAI</div>
      </div>
    </motion.div>
  );
}
