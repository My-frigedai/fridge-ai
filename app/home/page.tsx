"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { useFridge } from "@/app/components/FridgeProvider";
import NavBar from "@/app/components/NavBar";
import IngredientList from "@/app/components/IngredientList";
import BarcodeScanner from "@/app/components/BarcodeScanner";
import Toast from "@/app/components/Toast";
import AddEditModal from "@/app/components/AddEditModal";
import { motion, AnimatePresence } from "framer-motion";
import { fadeInUp, springTransition, buttonTap, tabSwitch } from "@/app/components/motion";

export default function HomePage() {
  const {
    toast,
    setToast,
    addOrUpdateItem,
    barcodeOpen,
    setBarcodeOpen,
    recognizedLabels,
  } = useFridge();

  const [isAddOpen, setAddOpen] = useState(false);

  // グローバルイベントで Add モーダルを開く
  useEffect(() => {
    const openAdd = () => setAddOpen(true);
    window.addEventListener("fridge_open_add", openAdd);
    return () => window.removeEventListener("fridge_open_add", openAdd);
  }, []);

  // バーコード検出時のコールバック
  const handleDetected = useCallback(
    async (code: string) => {
      await addOrUpdateItem({
        name: `バーコード:${code}`,
        quantity: 1,
        unit: "個",
        category: "その他",
      });
      setToast?.("バーコードから食材を追加しました");
      setBarcodeOpen(false);
    },
    [addOrUpdateItem, setToast, setBarcodeOpen]
  );

  // 食材を認識ラベルから追加する共通処理
  const handleAddLabel = (label: string) => {
    addOrUpdateItem({
      id: `id-${Date.now()}`,
      name: label,
      quantity: 1,
      unit: "個",
      expiry: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      category: "その他",
    });
    setToast?.(`${label} を追加しました`);
  };

  return (
    <motion.div
      className="mx-auto min-h-screen w-full pb-32 transition-colors duration-300"
      initial="hidden"
      animate="show"
      variants={fadeInUp}
    >
      {/* ヘッダー */}
      <motion.header
        className="sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 backdrop-blur card"
        variants={fadeInUp}
        transition={springTransition}
      >
        <div />
        <div className="text-lg font-bold">My Fridge</div>
        <motion.button
          onClick={() => window.dispatchEvent(new CustomEvent("fridge_open_add"))}
          className="rounded-full p-2 shadow-md barcode-btn"
          whileTap={buttonTap.whileTap}
          whileHover={buttonTap.whileHover}
          transition={springTransition}
        >
          <Plus size={18} />
        </motion.button>
      </motion.header>

      <main className="p-4 pb-28 space-y-4">
        {/* 検索バー */}
        <motion.div className="mb-3 flex items-center gap-2 rounded-2xl border px-3 py-2 card" variants={fadeInUp}>
          <span>🔍</span>
          <input placeholder="食材を検索" className="w-full bg-transparent outline-none" />
        </motion.div>

        {/* 食材リスト */}
        <motion.div className="card p-3" variants={fadeInUp}>
          <div className="font-medium mb-2">食材リスト</div>
          <IngredientList />
        </motion.div>

        {/* バーコードスキャンボタン */}
        <motion.div className="flex justify-center mt-6" variants={fadeInUp}>
          <motion.button
            onClick={() => setBarcodeOpen(true)}
            className="barcode-btn shadow-md"
            whileTap={buttonTap.whileTap}
            whileHover={buttonTap.whileHover}
            transition={springTransition}
          >
            バーコードスキャン
          </motion.button>
        </motion.div>

        {/* 認識ラベルから食材追加 */}
        <AnimatePresence>
          {recognizedLabels && recognizedLabels.length > 0 && (
            <motion.div
              className="card mt-4 flex flex-wrap gap-2 tab-content"
              initial="hidden"
              animate="show"
              exit="hidden"
              variants={tabSwitch}
            >
              {recognizedLabels.map((label) => (
                <motion.button
                  key={label}
                  onClick={() => handleAddLabel(label)}
                  className="px-2 py-1 rounded-full text-sm barcode-btn"
                  whileTap={buttonTap.whileTap}
                  whileHover={buttonTap.whileHover}
                  transition={springTransition}
                >
                  {label} を追加
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* 食材追加モーダル */}
      <AnimatePresence>
        {isAddOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm card p-4 shadow-lg"
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={springTransition}
            >
              <AddEditModal
                item={null}
                onSave={(it) => {
                  addOrUpdateItem(it);
                  setAddOpen(false);
                }}
                onCancel={() => setAddOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BarcodeScanner */}
      <AnimatePresence>
        {barcodeOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BarcodeScanner visible={barcodeOpen} onDetected={handleDetected} onClose={() => setBarcodeOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <NavBar />
      <Toast msg={toast} onClose={() => setToast(null)} />
    </motion.div>
  );
}
