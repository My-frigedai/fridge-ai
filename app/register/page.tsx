// app/register/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/components/ThemeProvider";
import { fadeInUp, springTransition, buttonTap } from "@/app/components/motion";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "email" | "verify">("select");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState(""); // 確認コード入力用

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
        setMsg("Google認証に失敗しました。もう一度お試しください。");
      }
    } catch (err) {
      console.error("Google signIn error:", err);
      setMsg("Google認証中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleApple = () => {
    alert("Appleでの登録は今後実装予定です");
  };

  async function parseApiResponse(res: Response) {
    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, text };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!email || !password) return setMsg("メールアドレスとパスワードは必須です。");
    if (password.length < 8) return setMsg("パスワードは8文字以上にしてください。");
    if (password !== confirm) return setMsg("パスワードが一致しません。");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          mode: "register",
        }),
      });

      const { ok, status, data, text } = await parseApiResponse(res);
      console.log("register response:", { ok, status, data, text });

      if (!ok) {
        if (status === 409) setMsg("このメールアドレスはすでに登録されています。");
        else if (status === 400) setMsg(data?.message || "入力内容に不備があります。");
        else setMsg(data?.message || "登録に失敗しました。");
        return;
      }

      setStep("verify");
      setMsg("確認メールを送信しました。メールに記載の6桁コードを入力してください。");
    } catch (err) {
      console.error("register fetch error:", err);
      setMsg("サーバーエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!code) return setMsg("確認コードを入力してください。");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const { ok, status, data, text } = await parseApiResponse(res);
      console.log("verify-otp response:", { ok, status, data, text });

      if (!ok) {
        if (status === 400) setMsg(data?.message || "確認コードが無効、または期限切れです。");
        else setMsg(data?.message || "確認に失敗しました。");
        return;
      }

      const signInResult = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if ((signInResult as any)?.ok) {
        router.push("/");
      } else {
        router.push("/login?registered=1");
      }
    } catch (err) {
      console.error("verify submit error:", err);
      setMsg("認証処理でエラーが発生しました。");
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
        body: JSON.stringify({ email, mode: "register" }),
      });
      const { ok, status, data, text } = await parseApiResponse(res);
      console.log("resend response:", { ok, status, data, text });

      if (!ok) {
        if (status === 429) setMsg("再送リクエストが多すぎます。しばらくしてから再試行してください。");
        else setMsg(data?.message || "確認メールの再送に失敗しました。");
        return;
      }

      setMsg("確認メールを再送しました。メールを確認してください。");
    } catch (err) {
      console.error("resend error:", err);
      setMsg("再送信でエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="min-h-screen flex items-center justify-start pt-12 pb-8 transition-colors duration-300" initial="hidden" animate="show" variants={fadeInUp}>
      <div className="w-full max-w-md h-screen mx-auto flex flex-col justify-between items-center -translate-y-6 p-6">
        <div className="flex flex-col items-center gap-2">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <Image
              src={isDark ? "/my-fridgeai-logo-white.png" : "/my-fridgeai-logo.png"}
              alt="My-fridgeai"
              width={180}
              height={52}
              priority
            />
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1" transition={{ duration: 0.45, delay: 0.08 }}>
            <Image
              src={isDark ? "/fridge-illustration-dark.png" : "/fridge-illustration.png"}
              alt="Fridge illustration"
              width={220}
              height={130}
              priority
            />
          </motion.div>

          <h2 className="mt-2 text-center text-lg font-semibold text-primary">Welcome to My-FridgeAI</h2>
          <p className="text-center text-secondary mt-0">日常の食材管理を、もっとスマートに。</p>
        </div>

        <div className="w-full">
          {step === "select" ? (
            <div className="flex flex-col gap-3">
              <motion.button
                onClick={() => setStep("email")}
                disabled={loading}
                className="w-full surface-btn font-semibold py-3 rounded-full flex items-center justify-center gap-2 transition transform duration-150 ease-out active:translate-y-1 active:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                メールアドレスで新規登録
              </motion.button>

              <motion.button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full surface-btn font-semibold py-3 rounded-full flex items-center justify-center gap-2 transition transform duration-150 ease-out active:translate-y-1 active:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                {/* Google SVG（4色） */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" width="18" height="18" aria-hidden>
                  <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.4H272v95.4h146.9c-6.4 34.6-25.4 63.9-54.2 83.5v68h87.3c51.1-47.1 81-116.4 81-196.5z"/>
                  <path fill="#34A853" d="M272 544.3c73.2 0 134.6-24.3 179.4-65.7l-87.3-68c-24.2 16.2-55.1 26-92.1 26-70.8 0-130.7-47.7-152.2-111.9H27.9v70.9C72.6 486.4 165.5 544.3 272 544.3z"/>
                  <path fill="#FBBC05" d="M119.8 324.7c-10.6-31.6-10.6-65.7 0-97.3v-70.9H27.9c-39.3 77.8-39.3 168.5 0 246.3l90-78.1z"/>
                  <path fill="#EA4335" d="M272 107.7c38.8 0 73.6 13.4 101.2 39.6l75.9-75.9C406.6 24.3 345.2 0 272 0 166.5 0 74.6 60.6 29.8 149.1l90 70.5c21.5-64.2 81.4-111.9 152.2-111.9z"/>
                </svg>
                Googleで新規登録
              </motion.button>

              <motion.button
                onClick={handleApple}
                disabled
                className="w-full surface-btn font-semibold py-3 rounded-full border flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition transform duration-150 ease-out"
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="18" height="18" fill="currentColor" aria-hidden>
                  <path d="M318.7 268.7c-.2-37.3 16.4-65.7 50-86.2-18.8-27.6-47.2-42.7-86.2-45.5-36.3-2.7-76.2 21.3-90.3 21.3-15 0-50-20.4-77.6-19.8-56.8.8-116.5 46.4-116.5 139.3 0 27.5 5 56.1 15 85.8 13.4 38.7 61.9 133.6 112.3 132 23.9-.5 40.8-16.9 76.3-16.9 34.6 0 50.3 16.9 77.6 16.3 50.8-1 94.7-85.3 107.9-124.2-68.4-32.3-68.5-95-68.5-101.8zM257.5 85.4C282 58.6 293.4 24.1 289 0c-26.6 1.1-57.9 18-76.6 39.2-16.8 19.3-31.6 46.9-27.6 74.4 29.1 2.2 58.9-14.8 72.7-28.2z"/>
                </svg>
                Appleで新規登録
              </motion.button>

              <p className="text-xs text-center text-secondary mt-2">
                続行すると、
                <a href="/terms" className="underline ml-1 text-primary">利用規約</a>
                と
                <a href="/privacy" className="underline ml-1 text-primary">プライバシーポリシー</a>
                に同意したことになります。
              </p>

              <p className="text-xs text-center text-muted mt-2">
                すでにアカウントをお持ちですか？
                <a href="/login" className="underline ml-1 text-primary">ログイン</a>
              </p>
            </div>
          ) : step === "email" ? (
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <input
                className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm focus:outline-none dark:text-gray-100"
                placeholder="表示名（任意）"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm focus:outline-none dark:text-gray-100"
                placeholder="メールアドレス"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm focus:outline-none dark:text-gray-100"
                placeholder="パスワード（8文字以上）"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <input
                className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm focus:outline-none dark:text-gray-100"
                placeholder="パスワード（確認）"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />

              {msg && <div className="text-sm text-red-600">{msg}</div>}

              <motion.button
                className="w-full bg-black dark:bg-white dark:text-black text-white font-semibold py-3 rounded-full transition transform duration-150 ease-out active:translate-y-1 active:brightness-95 disabled:opacity-60"
                type="submit"
                disabled={loading}
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                {loading ? "登録中…" : "アカウントを作成"}
              </motion.button>

              <button
                type="button"
                className="w-full mt-2 text-center text-sm underline disabled:opacity-60"
                onClick={() => setStep("select")}
                disabled={loading}
              >
                ← 戻る
              </button>
            </form>
          ) : (
            // verify ステップ
            <form onSubmit={handleVerifySubmit} className="flex flex-col gap-3">
              <p className="text-sm text-secondary">
                確認メールを送信しました。メール内の6桁コードを入力してください。
              </p>

              <input
                className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm focus:outline-none tracking-widest text-center dark:text-gray-100"
                placeholder="確認コード（例: 123456）"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />

              {msg && <div className="text-sm text-red-600">{msg}</div>}

              <motion.button
                type="submit"
                className="w-full bg-black dark:bg-white dark:text-black text-white font-semibold py-3 rounded-full disabled:opacity-60"
                disabled={loading}
                whileTap={buttonTap.whileTap}
                whileHover={buttonTap.whileHover}
                transition={springTransition}
              >
                {loading ? "認証中…" : "確認してアカウントを有効化"}
              </motion.button>

              <div className="flex gap-3">
                <motion.button
                  type="button"
                  className="w-1/2 bg-white dark:bg-gray-800 rounded-full border py-2 text-sm disabled:opacity-60"
                  onClick={handleResend}
                  disabled={loading}
                  whileTap={buttonTap.whileTap}
                  transition={springTransition}
                >
                  コードを再送
                </motion.button>
                <button
                  type="button"
                  className="w-1/2 text-sm underline disabled:opacity-60"
                  onClick={() => setStep("select")}
                  disabled={loading}
                >
                  ← キャンセル
                </button>
              </div>
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
