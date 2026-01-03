// app/reset-password/request/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetRequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setMsg(null);
    if (!email) {
      setMsg("メールアドレスを入力してください");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(j?.message || "送信に失敗しました");
      } else {
        setMsg(
          "確認メールを送信しました。メールを確認してください（届いていない場合は迷惑メールもご確認ください）。",
        );
      }
    } catch (err) {
      console.error(err);
      setMsg("メール送信中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <h1 className="text-lg font-semibold mb-4">パスワードをリセット</h1>
        <p className="text-sm text-muted mb-4">
          登録済みのメールアドレスを入力すると、再設定用のリンクをお送りします。
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border px-3 py-2"
            required
          />
          {msg && <div className="text-sm text-red-600">{msg}</div>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-black text-white py-2 rounded"
            >
              {loading ? "送信中…" : "再設定リンクを送る"}
            </button>
            <button
              type="button"
              className="flex-1 border rounded py-2"
              onClick={() => router.back()}
            >
              戻る
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
