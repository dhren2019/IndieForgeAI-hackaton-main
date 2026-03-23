import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
  padding?: "none" | "sm" | "md" | "lg";
}

export function Card({
  children,
  className = "",
  hoverable = false,
  onClick,
  padding = "md",
}: CardProps) {
  return (
    <div
      className={[
        "card",
        `card--pad-${padding}`,
        hoverable ? "card--hoverable" : "",
        onClick ? "card--clickable" : "",
        className,
      ].filter(Boolean).join(" ")}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      {children}
    </div>
  );
}
