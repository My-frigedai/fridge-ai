// app/reset-password/confirm/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function ResetConfirmPage() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const emailParam = params.get("email") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token || !emailParam) {
      setMsg("無効なリンクです。リンクをもう一度ご確認ください。");
    }
  }, [token, emailParam]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setMsg(null);
    if (!password || password.length < 8) {
      setMsg("パスワードは8文字以上にしてください");
      return;
    }
    if (password !== confirm) {
      setMsg("パスワードが一致しません");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailParam, token, password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        setMsg(j?.message || "パスワード更新に失敗しました");
        setLoading(false);
        return;
      }

      // 自動サインイン（パスワードで）
      const sres: any = await signIn("credentials", {
        redirect: false,
        email: emailParam,
        password,
      });
      if (sres?.ok) {
        router.replace("/");
      } else {
        router.replace("/login?registered=1");
      }
    } catch (err) {
      console.error(err);
      setMsg("サーバーエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-lg font-semibold mb-4">新しいパスワードを設定</h1>
        <p className="text-sm text-muted mb-4">
          安全なパスワードを入力してください。（8文字以上）
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            placeholder="新しいパスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          />
          <input
            type="password"
            placeholder="新しいパスワード（確認）"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          />
          {msg && <div className="text-sm text-red-600">{msg}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-2 rounded"
          >
            {loading ? "処理中…" : "パスワードを更新してログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
