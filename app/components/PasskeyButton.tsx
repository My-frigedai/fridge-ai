// app/components/PasskeyButton.tsx
"use client";

import React from "react";

type Props = {
  onCreate: () => Promise<void> | void;
  disabled?: boolean;
};

export default function PasskeyButton({ onCreate, disabled }: Props) {
  const handleClick = async () => {
    try {
      // onCreate will perform the flow: fetch options -> navigator.credentials.create -> send attestation
      await onCreate();
    } catch (err: any) {
      // If user cancels the OS prompt, NotAllowedError occurs — handle quietly
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        console.log("Passkey creation canceled by user or timed out.");
        return;
      }
      // Unexpected errors should be visible in console for debugging
      console.error("PasskeyButton: unexpected error:", err);
      // rethrow if caller wants to handle it
      throw err;
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className="w-full bg-black dark:bg-white dark:text-black text-white font-semibold py-3 rounded-full"
      aria-disabled={disabled}
    >
      {disabled ? "登録中…" : "パスキーを作成"}
    </button>
  );
}
