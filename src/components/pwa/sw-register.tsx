"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Check for updates silently
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "activated" &&
                navigator.serviceWorker.controller
              ) {
                // New version available — will activate on next visit
                console.log("[SW] Nouvelle version disponible.");
              }
            });
          });
        })
        .catch((err) => {
          console.error("[SW] Erreur d'enregistrement :", err);
        });
    }
  }, []);

  return null;
}
