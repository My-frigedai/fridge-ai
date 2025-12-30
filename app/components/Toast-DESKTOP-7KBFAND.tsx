// components/Toast.tsx
"use client";
import React, { useEffect } from "react";

export default function Toast({
  msg,
  onClose,
}: {
  msg: string | null;
  onClose?: () => void;
}) {
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => onClose?.(), 3500);
    return () => clearTimeout(t);
  }, [msg, onClose]);

  if (!msg) return null;
  return (
    <div className="fixed left-1/2 top-6 -translate-x-1/2 z-50">
      <div className="rounded-xl bg-black/90 px-4 py-2 text-sm text-white shadow-lg">
        {msg}
      </div>
    </div>
  );
}
