// app/components/SubscriptionButton.tsx
"use client";
import React, { useState } from "react";

export default function SubscriptionButton({ isPremium, onStart, onToast }: { isPremium: boolean; onStart?: ()=>void; onToast?: (m:string)=>void }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    if (isPremium) { onToast?.("既にプレミアム会員です。ありがとうございます！"); return; }
    setLoading(true);
    onStart?.();
    try {
      const res = await fetch("/api/stripe/createCheckoutSession", { method: "POST" });
      const j = await res.json();
      if (!res.ok) { onToast?.(j?.error ?? "支払いページを開けませんでした"); setLoading(false); return; }
      if (j.url) { window.location.href = j.url; } else { onToast?.("支払いページの準備に失敗しました"); setLoading(false); }
    } catch (err) {
      console.error(err);
      onToast?.("通信エラーが発生しました。ネットワークを確認してください。");
      setLoading(false);
    }
  };
  return (
    <button onClick={handleClick} disabled={loading} className="rounded-full bg-purple-600 px-4 py-2 text-white">
      {loading ? "接続中..." : (isPremium ? "プレミアム会員" : "プレミアム登録")}
    </button>
  );
}
