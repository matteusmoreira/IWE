"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

// Botão mínimo de modo escuro: guarda preferência em localStorage e aplica na <html>
export default function DarkModeButton() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("darkMode") === "true";
    setDark(!!saved);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", !!saved);
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    try {
      localStorage.setItem("darkMode", String(next));
    } catch {}
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Desativar modo escuro" : "Ativar modo escuro"}>
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}