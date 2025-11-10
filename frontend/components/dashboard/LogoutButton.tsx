"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

// Botão mínimo de logout. Faz signOut no cliente e redireciona.
export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso!");
      router.push("/auth/login");
    } catch (e) {
      toast.error("Erro ao fazer logout");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleLogout} disabled={loading} aria-label="Sair">
      <LogOut className="h-5 w-5" />
    </Button>
  );
}