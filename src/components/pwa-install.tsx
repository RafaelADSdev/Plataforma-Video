"use client";

import { ArrowDownToLine } from "lucide-react";
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function capturePrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }

    function markInstalled() {
      setInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowHelp((visible) => !visible);
      return;
    }

    setShowHelp(false);
    setInstallPrompt(null);
    try {
      const { outcome } = await installPrompt.prompt();
      if (outcome === "accepted") setInstalled(true);
    } catch {
      setShowHelp(true);
    }
  }

  if (installed) return null;

  return (
    <div className="login-install">
      <button
        type="button"
        onClick={install}
        aria-expanded={installPrompt ? undefined : showHelp}
        aria-controls={installPrompt ? undefined : "install-help"}
      >
        <ArrowDownToLine size={17} aria-hidden="true" />
        Instalar aplicativo
      </button>
      <div id="install-help" className="login-install-help" hidden={!showHelp}>
        <p>No iPhone, no Safari, vá de <strong>Compartilhar</strong> para <strong>Adicionar à Tela de Início</strong>. Ative <strong>Abrir como App da Web</strong> se a opção aparecer.</p>
        <p>No Android ou computador, procure <strong>Instalar</strong>, <strong>Adicionar à tela inicial</strong> ou <strong>Adicionar ao Dock</strong> no menu do navegador.</p>
      </div>
    </div>
  );
}
