//app/components/ui/dialog/DialogHeader.tsx
import { ReactNode } from "react";

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="mb-4">{children}</div>;
}
