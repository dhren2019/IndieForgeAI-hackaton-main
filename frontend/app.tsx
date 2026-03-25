import React from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";

import { AppProvider, useAppState } from "./state/app-state";
import { Header }                   from "./components/layout/Header";
import { LeftNav }                  from "./components/layout/LeftNav";
import { ToastContainer }           from "./components/ui/Toast";
import { HomePage }                 from "./pages/HomePage";
import { HistoryPage }              from "./pages/HistoryPage";
import { FavoritesPage }            from "./pages/FavoritesPage";
import { SocialPage }               from "./pages/SocialPage";
import { ProjectsPage }             from "./pages/ProjectsPage";
import { setTokenGetter }           from "./lib/auth-token";

const CLERK_KEY = process.env.CLERK_PUBLISHABLE_KEY ?? "";

/** Keeps the module-level token getter in sync with Clerk auth state */
function ClerkTokenSync() {
  const { getToken, isSignedIn } = useAuth();
  React.useEffect(() => {
    setTokenGetter(isSignedIn ? getToken : null);
  }, [getToken, isSignedIn]);
  return null;
}

function Pages() {
  const { tab, toasts, showToast, navCollapsed } = useAppState();

  React.useEffect(() => {
    document.getElementById("root")?.classList.toggle("nav-collapsed", navCollapsed);
  }, [navCollapsed]);

  return (
    <>
      <Header />
      <LeftNav />
      <main className="app-main">
        {tab === "generate"  && <HomePage    onToast={showToast} />}
        {tab === "history"   && <HistoryPage onToast={showToast} />}
        {tab === "favorites" && <FavoritesPage onToast={showToast} />}
        {tab === "social"    && <SocialPage  onToast={showToast} />}
        {tab === "projects"  && <ProjectsPage onToast={showToast} />}
      </main>
      <ToastContainer toasts={toasts} />
    </>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <ClerkTokenSync />
      <AppProvider>
        <Pages />
      </AppProvider>
    </ClerkProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
