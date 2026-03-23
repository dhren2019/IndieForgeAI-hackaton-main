import React from "react";
import type { ButtonVariant } from "../../types/ui";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariant {
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  fullWidth = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const classes = [
    "btn",
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? "btn--full" : "",
    loading ? "btn--loading" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && <span className="btn__spinner" />}
      {!loading && icon && <span className="btn__icon">{icon}</span>}
      {children}
    </button>
  );
}
