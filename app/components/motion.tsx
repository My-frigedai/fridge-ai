// app/components/motion.tsx
"use client";

import type { Variants, Transition } from "framer-motion";

// ✅ Framer MotionのTransition型を明示
export const springTransition: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 28,
};

// アニメーションバリエーション
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.995 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.25, 1, 0.5, 1] },
  },
};

export const tabSwitch: Variants = {
  hidden: { opacity: 0, x: 16, scale: 0.98, filter: "blur(2px)" },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.42, ease: [0.25, 1, 0.5, 1] },
  },
};

export const buttonTap = {
  whileTap: { scale: 0.985, transition: { duration: 0.12 } },
  whileHover: { scale: 1.02, transition: { duration: 0.18 } },
};
