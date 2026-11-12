"use client";

import { useEffect } from "react";

export function PwaWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.warn("Não foi possível ativar o modo offline da Sala do Curso.", error);
    });
  }, []);

  return null;
}
