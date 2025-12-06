// components/NavBar.tsx
"use client";
import React from "react";
import Link from "next/link";
import { Home, ChefHat, ShoppingCart, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { springTransition } from "@/app/components/motion";

export default function NavBar() {
  const pathname = usePathname();

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-40 mx-auto mb-2 w-full max-w-md rounded-2xl border border-gray-200 bg-white/80 p-2 shadow-2xl"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={springTransition}
    >
      <div className="grid grid-cols-4 gap-2">
        <NavItem
          to="/home"
          active={pathname?.startsWith("/home") ?? pathname === "/"}
          icon={<Home size={18} />}
          label="ホーム"
        />
        <NavItem
          to="/recipes"
          active={pathname?.startsWith("/recipes")}
          icon={<ChefHat size={18} />}
          label="献立"
        />
        <NavItem
          to="/shopping-list"
          active={pathname?.startsWith("/shopping-list")}
          icon={<ShoppingCart size={18} />}
          label="買い物"
        />
        <NavItem
          to="/settings"
          active={pathname?.startsWith("/settings")}
          icon={<Settings size={18} />}
          label="設定"
        />
      </div>
    </motion.div>
  );
}

function NavItem({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={to}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-3 py-2 text-xs transition ${active ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
    >
      {icon}
      <div className="leading-none">{label}</div>
    </Link>
  );
}
