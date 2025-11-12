"use client";
import { useEffect, useState } from "react";

export default function InstallPWAButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  if (!visible || !promptEvent) return null;

  const onInstall = async () => {
    const res = await promptEvent.prompt();
    setVisible(false);
  };

  return (
    <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 50 }}>
      <button
        onClick={onInstall}
        className="px-4 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-500"
      >
        Instalar App
      </button>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<unknown>;
}

