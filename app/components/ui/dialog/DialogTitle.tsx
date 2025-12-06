//app/components/ui/dialog/DialogTitle.tsx
import { ReactNode, HTMLAttributes } from "react";

type DialogTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  children: ReactNode;
};

export function DialogTitle({
  children,
  className = "",
  ...props
}: DialogTitleProps) {
  return (
    <h2 className={`text-xl font-bold ${className}`} {...props}>
      {children}
    </h2>
  );
}
