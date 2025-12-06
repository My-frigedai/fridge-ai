//app/components/ui/dialog/DialogContent.tsx
import { ReactNode } from "react";

export function DialogContent({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-lg p-6 shadow-lg w-full max-w-lg ${className}`}
    >
      {children}
    </div>
  );
}
