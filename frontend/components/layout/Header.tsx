import React from "react";
import { SignInButton, UserButton, useAuth } from "@clerk/clerk-react";

export function Header() {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <img src="/indieforgeai-logo.png" alt="IndieForge AI" className="app-header__logo" />
      </div>
      <div className="app-header__actions">
        {/* Login icon — left of the AI Powered badge */}
        {isLoaded && (
          isSignedIn ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "app-header__user-avatar",
                },
              }}
            />
          ) : (
            <SignInButton mode="modal">
              <button className="app-header__login-btn" title="Iniciar sesión / Crear cuenta" aria-label="Iniciar sesión">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </button>
            </SignInButton>
          )
        )}
        <span className="app-header__badge">✦ AI Powered</span>
      </div>
    </header>
  );
}
