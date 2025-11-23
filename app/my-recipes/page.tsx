// app/my-recipes/page.tsx
"use client";
import React, { useEffect, useState } from "react";
import NavBar from "@/app/components/NavBar";
import { motion } from "framer-motion";

export default function MyRecipesPage() {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("fridgeapp:generatedHistory");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setHistory(parsed);
      }
    } catch (e) {
      console.warn("history read failed", e);
    }
  }, []);

  const clearAll = () => {
    if (!confirm("履歴を全部消しますか？")) return;
    localStorage.removeItem("fridgeapp:generatedHistory");
    setHistory([]);
  };

  const loadToWizard = (menus: any[]) => {
    // store menus into fridgeapp:menus so RecipeWizard can pick them up
    try {
      localStorage.setItem("fridgeapp:menus", JSON.stringify(menus));
      alert("献立をウィザードに読み込みました。献立ページに戻って確認してください。");
    } catch (e) {
      alert("読み込みに失敗しました");
    }
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-md text-[var(--color-text-primary)] pb-32">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 flex items-center justify-between px-4 py-3">
        <div />
        <div className="text-lg font-semibold">保存済みの献立（履歴）</div>
        <div />
      </motion.header>

      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.02 }} className="p-4 pb-28">
        {history.length === 0 ? (
          <div className="text-gray-500 text-center py-8">履歴がありません。献立を生成するとここに保存されます。</div>
        ) : (
          <div className="space-y-3">
            {history.map((h, idx) => (
              <div key={idx} className="p-3 border rounded bg-white dark:bg-gray-800">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm text-gray-500">{new Date(h.createdAt).toLocaleString()}</div>
                    <div className="font-semibold">{Array.isArray(h.menus) && h.menus[0] ? h.menus[0].title : "保存された献立"}</div>
                    <div className="text-xs text-gray-500 mt-1">{Array.isArray(h.menus) ? `${h.menus.length} 件の候補` : ""}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded px-3 py-1 bg-blue-600 text-white" onClick={() => loadToWizard(h.menus)}>ウィザードに読み込み</button>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <button className="rounded px-3 py-1 bg-red-600 text-white" onClick={clearAll}>履歴を全て削除</button>
            </div>
          </div>
        )}
      </motion.main>
      <NavBar />
    </div>
  );
}
