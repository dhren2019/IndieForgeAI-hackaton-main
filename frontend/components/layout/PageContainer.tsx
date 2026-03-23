import React from "react";

interface PageContainerProps {
  children: React.ReactNode;
  narrow?: boolean;
  wide?: boolean;
}

export function PageContainer({ children, narrow = false, wide = false }: PageContainerProps) {
  return (
    <main className={`page-container ${narrow ? "page-container--narrow" : ""} ${wide ? "page-container--wide" : ""}`}>
      {children}
    </main>
  );
}
