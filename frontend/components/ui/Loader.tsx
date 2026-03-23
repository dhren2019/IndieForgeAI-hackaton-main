import React from "react";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  center?: boolean;
}

export function Loader({ size = "md", label, center = false }: LoaderProps) {
  return (
    <div className={`loader-wrap ${center ? "loader-wrap--center" : ""}`}>
      <span className={`spinner spinner--${size}`} aria-hidden="true" />
      {label && <span className="loader-label">{label}</span>}
    </div>
  );
}
