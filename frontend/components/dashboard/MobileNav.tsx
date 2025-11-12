"use client"
import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/ui/logo'
import { Menu, X, LayoutDashboard, Users, Shield, FileText, MessageCircle, Settings } from 'lucide-react'

interface MenuItem {
  label: string
  href: string
  icon: 'dashboard' | 'users' | 'shield' | 'fileText' | 'messageCircle' | 'settings'
}

export default function MobileNav({ menuItems }: { menuItems: MenuItem[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <button
        aria-label="Abrir menu"
        className="p-2 rounded-md border bg-card hover:bg-muted"
        onClick={() => setOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] bg-card border-r border-border shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <Logo size="lg" />
              <button
                aria-label="Fechar menu"
                className="p-2 rounded-md hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="px-2 py-3">
              <ul className="space-y-1">
                {menuItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted"
                    >
                      {(() => {
                        const Icon =
                          item.icon === 'dashboard' ? LayoutDashboard :
                          item.icon === 'users' ? Users :
                          item.icon === 'shield' ? Shield :
                          item.icon === 'fileText' ? FileText :
                          item.icon === 'messageCircle' ? MessageCircle :
                          Settings
                        return <Icon className="w-5 h-5 text-muted-foreground" />
                      })()}
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
