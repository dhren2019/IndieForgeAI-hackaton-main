import React from "react";

export function Header() {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <img src="/indieforgeai-logo.png" alt="IndieForge AI" className="app-header__logo" />
      </div>
      <div className="app-header__actions">
        <span className="app-header__badge">✦ AI Powered</span>
      </div>
    </header>
  );
}
