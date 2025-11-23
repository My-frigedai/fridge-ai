// app/reset-password/[token]/page.tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ResetTokenPage() {
  const { token } = useParams() as { token?: string };
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!password || password.length < 8) return setMsg("パスワードは8文字以上で入力してください。");
    if (password !== confirm) return setMsg("パスワードが一致しません。");

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg(data?.message || "再設定に失敗しました。リンクが古い可能性があります。");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 1800);
    } catch (err) {
      console.error(err);
      setMsg("サーバーエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
        <div className="bg-white p-6 rounded shadow">
          <p>無効なリンクです。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md mx-auto h-[72vh] overflow-hidden">
        <div className="bg-white rounded-2xl shadow-lg h-full p-6 flex flex-col justify-center">
          <h2 className="text-xl font-semibold text-center">パスワードの再設定</h2>
          {!done ? (
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
              <input className="input" placeholder="新しいパスワード（8文字以上）" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <input className="input" placeholder="パスワード（確認）" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {msg && <div className="text-sm text-red-600">{msg}</div>}
              <button className="w-full bg-black text-white py-3 rounded-full" disabled={loading}>
                {loading ? "更新中…" : "パスワードを更新する"}
              </button>
              <a href="/login" className="text-sm underline text-center">ログインに戻る</a>
            </form>
          ) : (
            <div className="text-center">
              <p className="text-sm text-gray-700">パスワードを更新しました。ログイン画面に戻ります…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
