import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  wide?: boolean;
}

export function PageContainer({ children, wide = false }: PageContainerProps) {
  return (
    <div
      className={
        wide
          ? "mx-auto w-full max-w-5xl"
          : "mx-auto w-full max-w-lg md:max-w-2xl"
      }
    >
      {children}
    </div>
  );
}
