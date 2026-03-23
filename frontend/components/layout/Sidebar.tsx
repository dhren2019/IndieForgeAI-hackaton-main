import React from "react";

interface SidebarProps {
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return <aside className="sidebar">{children}</aside>;
}

export function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sidebar__section">
      <div className="sidebar__title">{title}</div>
      {children}
    </div>
  );
}
