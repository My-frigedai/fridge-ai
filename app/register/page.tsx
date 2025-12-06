// app/register/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/app/components/ThemeProvider";

/**
 * small helpers for base64url <-> Uint8Array
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

/** Convert various server-provided shapes into types consumable by navigator.credentials */
function toUint8Array(input: any): Uint8Array {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (Array.isArray(input)) return new Uint8Array(input);
  if (typeof input === "string") {
    // try base64url then base64
    try {
      return base64urlToUint8Array(input);
    } catch (e) {
      // try atob on normal base64
      const pad = input.length % 4;
      const base64Padded = pad ? input + "=".repeat(4 - pad) : input;
      const bin = atob(base64Padded);
      const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u;
    }
  }
  throw new Error("Unsupported input for toUint8Array");
}

/** convert server publicKey/options -> navigator-friendly */
function preformatCreateOptions(opts: any) {
  if (!opts) throw new Error("No options provided");
  const publicKeyObj = opts.publicKey ? { ...opts.publicKey } : { ...opts };

  // challenge
  if (!("challenge" in publicKeyObj)) throw new Error("Registration options missing 'challenge'");
  publicKeyObj.challenge = toUint8Array(publicKeyObj.challenge);

  // user.id (optional but helpful)
  if (publicKeyObj.user && publicKeyObj.user.id != null) {
    publicKeyObj.user.id = toUint8Array(publicKeyObj.user.id);
  }

  // excludeCredentials
  if (Array.isArray(publicKeyObj.excludeCredentials)) {
    publicKeyObj.excludeCredentials = publicKeyObj.excludeCredentials.map((c: any) => {
      const out: any = { ...c };
      if (out.id != null) out.id = toUint8Array(out.id);
      return out;
    });
  }

  return publicKeyObj;
}

/** serialize attestation for server */
function serializeAttestation(credential: any) {
  if (!credential) throw new Error("No credential to serialize");
  const rawId = credential.rawId ?? credential.id;
  return {
    id: credential.id,
    rawId: uint8ArrayToBase64url(rawId),
    type: credential.type,
    response: {
      attestationObject: uint8ArrayToBase64url(credential.response?.attestationObject),
      clientDataJSON: uint8ArrayToBase64url(credential.response?.clientDataJSON),
    },
  };
}

/** Minimal motion helpers to avoid TypeScript transition typing trouble */
const buttonTap = {
  whileTap: { scale: 0.995 } as any,
  whileHover: { scale: 1.01 } as any,
};
const springTransition = { type: "spring", stiffness: 700, damping: 30 } as any;

export default function RegisterPage() {
  const router = useRouter();

  const [step, setStep] = useState<"select" | "email" | "passkey">("select");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Theme
  const { theme } = useTheme();
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const applied = typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null;
    setIsDark(applied ? applied === "dark" : theme === "dark");
  }, [theme]);

  async function savePassword() {
    const res = await fetch("/api/auth/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to save password");
    }
    return true;
  }

  async function getRegistrationOptions() {
    const res = await fetch("/api/auth/webauthn/register-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    const j = await res.json();
    if (!res.ok || !j?.ok) {
      // bubble server message if present
      throw new Error(j?.message || "Failed to get registration options");
    }
    return j.options;
  }

  async function sendAttestation(attObj: any) {
    const res = await fetch("/api/auth/webauthn/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, attestationResponse: attObj }),
    });
    const j = await res.json();
    if (!res.ok || !j?.ok) {
      throw new Error(j?.message || "Failed to register passkey");
    }
    return j;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!email || !password) return setMsg("メールアドレスとパスワードは必須です。");
    if (password.length < 8) return setMsg("パスワードは8文字以上にしてください。");
    if (password !== confirm) return setMsg("パスワードが一致しません。");
    setLoading(true);
    try {
      await savePassword();
      setStep("passkey");
    } catch (err: any) {
      console.error("savePassword error:", err);
      setMsg(err?.message || "アカウント作成に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyRegister = async () => {
    setMsg(null);
    setLoading(true);
    try {
      const opts = await getRegistrationOptions();
      console.log("webauthn: server register-options (raw):", opts);

      const publicKey = preformatCreateOptions(opts);

      console.log("webauthn: prepared publicKey (summary):", {
        challengeType: Object.prototype.toString.call(publicKey.challenge),
        userIdType: publicKey.user ? Object.prototype.toString.call(publicKey.user.id) : undefined,
        excludeCredentials: Array.isArray(publicKey.excludeCredentials)
          ? publicKey.excludeCredentials.map((c: any) => Object.prototype.toString.call(c.id))
          : undefined,
      });

      const credential: any = (await navigator.credentials.create({ publicKey })) as any;
      if (!credential) throw new Error("No credential created or operation was cancelled by user");

      const serialized = serializeAttestation(credential);
      console.log("webauthn: serialized attestation:", { id: serialized.id, rawIdLength: serialized.rawId?.length });

      await sendAttestation(serialized);

      const signInResult = await signIn("credentials", { redirect: false, email, password });
      if ((signInResult as any)?.ok) {
        router.push("/");
      } else {
        router.push("/login?registered=1");
      }
    } catch (err: any) {
      console.error("passkey register error:", err);
      const message =
        err?.message && err.message.includes("Invalid") ? "サーバーから不正なデータが返されました（詳しくはコンソール）。" :
        err?.message || "パスキー登録に失敗しました。ブラウザの設定やセキュリティキーの状態を確認してください。";
      setMsg(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (err) {
      console.error("Google signIn error:", err);
      setMsg("外部プロバイダでの認証に失敗しました。");
    }
  };

  const handleApple = () => {
    alert("Appleでの登録は今後実装予定です");
  };

  return (
    <motion.div className="min-h-screen flex items-center justify-start pt-12 pb-8" initial="hidden" animate="show">
      <div className="w-full max-w-md h-screen mx-auto flex flex-col justify-between items-center -translate-y-6 p-6">
        <div className="flex flex-col items-center gap-2">
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 } as any}>
            <Image src={isDark ? "/my-fridgeai-logo-white.png" : "/my-fridgeai-logo.png"} alt="My-FridgeAI" width={180} height={52} priority />
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1" transition={{ duration: 0.45, delay: 0.08 } as any}>
            <Image src={isDark ? "/fridge-illustration-dark.png" : "/fridge-illustration.png"} alt="Fridge illustration" width={220} height={130} priority />
          </motion.div>

          <h2 className="mt-2 text-center text-lg font-semibold text-primary">Welcome to My-FridgeAI</h2>
          <p className="text-center text-secondary mt-0">日常の食材管理を、もっとスマートに。</p>
        </div>

        <div className="w-full">
          {step === "select" ? (
            <div className="flex flex-col gap-3">
              <motion.button onClick={() => setStep("email")} disabled={loading} className="w-full surface-btn font-semibold py-3 rounded-full" whileTap={buttonTap.whileTap as any} whileHover={buttonTap.whileHover as any} transition={springTransition}>
                メールアドレスで新規登録
              </motion.button>

              <motion.button onClick={handleGoogle} className="w-full surface-btn font-semibold py-3 rounded-full flex items-center justify-center gap-2" whileTap={buttonTap.whileTap as any} whileHover={buttonTap.whileHover as any} transition={springTransition}>
                {/* Google SVG */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" width="18" height="18" aria-hidden>
                  <path fill="#4285F4" d="M533.5 278.4c0-17.4-1.6-34.1-4.7-50.4H272v95.4h146.9c-6.4 34.6-25.4 63.9-54.2 83.5v68h87.3c51.1-47.1 81-116.4 81-196.5z"/>
                  <path fill="#34A853" d="M272 544.3c73.2 0 134.6-24.3 179.4-65.7l-87.3-68c-24.2 16.2-55.1 26-92.1 26-70.8 0-130.7-47.7-152.2-111.9H27.9v70.9C72.6 486.4 165.5 544.3 272 544.3z"/>
                  <path fill="#FBBC05" d="M119.8 324.7c-10.6-31.6-10.6-65.7 0-97.3v-70.9H27.9c-39.3 77.8-39.3 168.5 0 246.3l90-78.1z"/>
                  <path fill="#EA4335" d="M272 107.7c38.8 0 73.6 13.4 101.2 39.6l75.9-75.9C406.6 24.3 345.2 0 272 0 166.5 0 74.6 60.6 29.8 149.1l90 70.5c21.5-64.2 81.4-111.9 152.2-111.9z"/>
                </svg>
                Googleで新規登録
              </motion.button>

              <motion.button onClick={handleApple} disabled className="w-full surface-btn font-semibold py-3 rounded-full border flex items-center justify-center gap-2 disabled:opacity-60" whileTap={buttonTap.whileTap as any} whileHover={buttonTap.whileHover as any} transition={springTransition}>
                {/* Apple icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="18" height="18" fill="currentColor" aria-hidden>
                  <path d="M318.7 268.7c-.2-37.3 16.4-65.7 50-86.2-18.8-27.6-47.2-42.7-86.2-45.5-36.3-2.7-76.2 21.3-90.3 21.3-15 0-50-20.4-77.6-19.8-56.8.8-116.5 46.4-116.5 139.3 0 27.5 5 56.1 15 85.8 13.4 38.7 61.9 133.6 112.3 132 23.9-.5 40.8-16.9 76.3-16.9 34.6 0 50.3 16.9 77.6 16.3 50.8-1 94.7-85.3 107.9-124.2-68.4-32.3-68.5-95-68.5-101.8zM257.5 85.4C282 58.6 293.4 24.1 289 0c-26.6 1.1-57.9 18-76.6 39.2-16.8 19.3-31.6 46.9-27.6 74.4 29.1 2.2 58.9-14.8 72.7-28.2z"/>
                </svg>
                Appleで新規登録
              </motion.button>

              <p className="text-xs text-center text-secondary mt-2">
                続行すると
                <Link className="underline ml-1 text-primary" href="/terms">利用規約</Link>
                と
                <Link className="underline ml-1 text-primary" href="/privacy">プライバシーポリシー</Link>
                に同意したことになります。
              </p>

              <p className="text-xs text-center text-muted mt-2">
                すでにアカウントをお持ちですか？
                <Link className="underline ml-1 text-primary" href="/login">ログイン</Link>
              </p>
            </div>
          ) : step === "email" ? (
            <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
              <input className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm focus:outline-none dark:text-gray-100" placeholder="表示名（任意）" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm focus:outline-none dark:text-gray-100" placeholder="メールアドレス" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm focus:outline-none dark:text-gray-100" placeholder="パスワード（8文字以上）" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <input className="w-full bg-white dark:bg-gray-800 rounded-lg border px-3 py-2 text-sm focus:outline-none dark:text-gray-100" placeholder="パスワード（確認）" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />

              {msg && <div className="text-sm text-red-600">{msg}</div>}

              <motion.button className="w-full bg-black dark:bg-white dark:text-black text-white font-semibold py-3 rounded-full" type="submit" disabled={loading} whileTap={buttonTap.whileTap as any} whileHover={buttonTap.whileHover as any} transition={springTransition}>
                {loading ? "次へ…" : "パスキーで登録"}
              </motion.button>

              <button type="button" className="w-full mt-2 text-center text-sm underline disabled:opacity-60" onClick={() => setStep("select")} disabled={loading}>← 戻る</button>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-secondary">パスキーを作成してアカウント登録を完了します。</p>

              <motion.button type="button" className="w-full bg-black dark:bg-white dark:text-black text-white font-semibold py-3 rounded-full" onClick={handlePasskeyRegister} disabled={loading} whileTap={buttonTap.whileTap as any} whileHover={buttonTap.whileHover as any} transition={springTransition}>
                {loading ? "登録中…" : "パスキーを作成"}
              </motion.button>

              <button type="button" className="w-full mt-2 text-center text-sm underline disabled:opacity-60" onClick={() => setStep("select")} disabled={loading}>← 戻る</button>

              {msg && <div className="text-sm text-red-600">{msg}</div>}
            </div>
          )}
        </div>

        <div className="w-full text-center text-xs text-muted mt-2">© My-FridgeAI</div>
      </div>
    </motion.div>
  );
}
