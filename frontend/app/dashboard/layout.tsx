import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, FileText, Settings, Shield, MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import DarkModeButton from '@/components/dashboard/DarkModeButton';
import LogoutButton from '@/components/dashboard/LogoutButton';
import MobileNav from '@/components/dashboard/MobileNav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Buscar usuário autenticado pelo cookie (server-side)
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    // Redireciona no servidor evitando hidratação desnecessária quando não autenticado
    redirect('/auth/login');
  }

  // Obter registro completo do usuário (tabela public.users) usando Service Role no backend
  const admin = createAdminClient();
  let { data: userRow } = await admin
    .from('users')
    .select('*')
    .eq('auth_user_id', authUser!.id)
    .maybeSingle();

  if (!userRow && authUser?.email) {
    const { data: byEmail } = await admin
      .from('users')
      .select('*')
      .eq('email', authUser.email)
      .maybeSingle();
    if (byEmail) userRow = byEmail;
  }

  if (!userRow) {
    // Segurança: se não encontrou o registro, força login novamente
    redirect('/auth/login');
  }

  // Menu conforme papel do usuário
  const menuItems = [
    { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { label: 'Polos', href: '/dashboard/tenants', icon: 'users' },
    ...(userRow?.role === 'superadmin' ? [{ label: 'Admins', href: '/dashboard/admins', icon: 'shield' }] : []),
    ...(userRow?.role === 'superadmin' ? [{ label: 'Formulários', href: '/dashboard/forms', icon: 'fileText' }] : []),
    { label: 'Alunos', href: '/dashboard/submissions', icon: 'users' },
    { label: 'Mensagens', href: '/dashboard/messages', icon: 'messageCircle' },
    { label: 'Templates', href: '/dashboard/templates', icon: 'fileText' },
    ...(userRow?.role === 'superadmin' ? [{ label: 'Configurações', href: '/dashboard/settings', icon: 'settings' }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <aside
        className="fixed top-0 left-0 z-40 h-screen bg-card border-r border-border hidden md:block w-60"
      >
        <div className="h-full px-3 py-4 overflow-y-auto">
          <div className="flex items-center mb-5 px-3">
            <Logo size="xl" />
          </div>
          <ul className="space-y-2 font-medium">
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex items-center p-2 rounded-lg hover:bg-muted group">
                  {(() => {
                    const Icon =
                      item.icon === 'dashboard' ? LayoutDashboard :
                      item.icon === 'users' ? Users :
                      item.icon === 'shield' ? Shield :
                      item.icon === 'fileText' ? FileText :
                      item.icon === 'messageCircle' ? MessageCircle :
                      Settings
                    return <Icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                  })()}
                  <span className="ml-3">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="md:ml-60">
        <header className="sticky top-0 z-30 bg-card border-b border-border">
          <div className="px-4 py-3 flex items-center justify-between">
            <MobileNav menuItems={menuItems} />
            <div className="flex items-center gap-4">
              <DarkModeButton />
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium">{userRow?.name}</p>
                  <p className="text-xs text-muted-foreground">{userRow?.role}</p>
                </div>
                <LogoutButton />
              </div>
            </div>
          </div>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
