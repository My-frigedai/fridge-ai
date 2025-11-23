"use client";
import React from "react";
import NavBar from "@/app/components/NavBar";
import RecipeWizard from "@/app/components/RecipeWizard";
import Toast from "@/app/components/Toast";
import { useFridge } from "@/app/components/FridgeProvider";
import { motion } from "framer-motion";

export default function RecipesPage() {
  const { toast, setToast } = useFridge();
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-transparent text-gray-900 dark:text-gray-100 pb-32 transition-colors duration-300">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-40 flex items-center justify-between page-header px-4 py-3"
        /* page-header の CSS で背景と線は消しています */
      >
        <div />
        <div className="text-lg font-bold wizard-title">献立ウィザード</div>
        <div />
      </motion.header>

      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.04 }}
        className="p-4 pb-28"
      >
        <RecipeWizard />
      </motion.main>

      <NavBar />
      <Toast msg={toast} onClose={() => setToast(null)} />
    </div>
  );
}
