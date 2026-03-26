export type AppTab = "generate" | "history" | "favorites" | "social" | "projects" | "worldcreator";

export interface ToastMessage {
  id: string;
  msg: string;
  kind: "ok" | "error" | "warning";
}

export interface ButtonVariant {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}
