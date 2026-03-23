import React from "react";
import { createRoot } from "react-dom/client";

import { AppProvider, useAppState } from "./state/app-state";
import { Header }                   from "./components/layout/Header";
import { LeftNav }                  from "./components/layout/LeftNav";
import { ToastContainer }           from "./components/ui/Toast";
import { HomePage }                 from "./pages/HomePage";
import { HistoryPage }              from "./pages/HistoryPage";
import { FavoritesPage }            from "./pages/FavoritesPage";
import { SocialPage }               from "./pages/SocialPage";

function Pages() {
  const { tab, toasts, showToast } = useAppState();

  return (
    <>
      <Header />
      <LeftNav />
      <main className="app-main">
        {tab === "generate"  && <HomePage    onToast={showToast} />}
        {tab === "history"   && <HistoryPage onToast={showToast} />}
        {tab === "favorites" && <FavoritesPage onToast={showToast} />}
        {tab === "social"    && <SocialPage  onToast={showToast} />}
      </main>
      <ToastContainer toasts={toasts} />
    </>
  );
}

function App() {
  return (
    <AppProvider>
      <Pages />
    </AppProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
