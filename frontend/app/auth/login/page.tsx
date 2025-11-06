'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Logo from '@/components/ui/logo';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Busca o usuário via backend (/api/users/me) para contornar RLS e garantir consistência
  const getUserFromBackend = async (accessToken?: string | null) => {
    const res = await fetch('/api/users/me', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    if (!res.ok) {
      if (res.status === 404) return null
      const payload = await res.json().catch(() => ({}))
      throw new Error(payload?.error || 'Falha ao buscar usuário')
    }
    const payload = await res.json()
    return payload?.user ?? null
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Garantir o registro do usuário no backend
        const res = await fetch('/api/users/ensure', {
          method: 'POST',
          headers: {
            // Não logar este header.
            Authorization: `Bearer ${data.session?.access_token ?? ''}`,
          },
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error(payload?.error || 'Falha ao garantir registro de usuário')
        }

        // Obter o usuário pelo backend, com pequenos retries para latências
        const delays = [0, 200, 500];
        let userData: any = null;
        for (const d of delays) {
          if (d) await wait(d)
          userData = await getUserFromBackend(data.session?.access_token)
          if (userData) break
        }

        if (!userData) {
          throw new Error('Registro de usuário não encontrado. Tente novamente.');
        }

        if (!userData.is_active) {
          toast.error('Sua conta está desativada. Entre em contato com o administrador.');
          await supabase.auth.signOut();
          return;
        }

        toast.success('Login realizado com sucesso!');
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(error.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-primary via-brand-primary/90 to-brand-primary/80 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-2xl">Bem-vindo de volta</CardTitle>
          <CardDescription>
            Entre com suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-brand-primary hover:bg-brand-primary/90"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Esqueceu sua senha? Entre em contato com o administrador.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
