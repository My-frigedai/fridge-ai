import { ReactNode } from "react";

export function DialogTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-bold">{children}</h2>;
}
