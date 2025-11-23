import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn: 複数のclassNameを安全に結合するヘルパー
 * Shadcn UIのコンポーネントが内部で使用
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
