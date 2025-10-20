import React from 'react';
import Link from 'next/link';
import LogoutButton from '../components/LogoutButton';

export const metadata = {
  title: 'EduClub — Dashboard',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const items = [
    { href: '/dashboard', label: 'Inicio', icon: '🏠' },
    { href: '/dashboard/cursos', label: 'Cursos', icon: '📚' },
    { href: '/dashboard/calendario', label: 'Calendario', icon: '📅' },
    { href: '/dashboard/informes', label: 'Informes', icon: '📄' },
    { href: '/dashboard/notificaciones', label: 'Notificaciones', icon: '🔔' },
    { href: '/dashboard/foros', label: 'Foros', icon: '💬' },
    { href: '/dashboard/recursos', label: 'Recursos', icon: '📎' },
    { href: '/dashboard/calificaciones', label: 'Calificaciones', icon: '⭐' },
    { href: '/dashboard/perfil', label: 'Perfil', icon: '👤' },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
  <aside className="w-20 md:w-64 bg-white border-r border-gray-100 shadow-sm sticky top-0 h-screen overflow-y-auto print:hidden">
        <div className="flex flex-col items-center md:items-start py-6 px-3 md:px-6 gap-6">
          <div className="hidden md:flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-md bg-gradient-to-br from-violet-600 to-cyan-400 flex items-center justify-center text-white font-bold">E</div>
            <div>
              <div className="text-sm font-semibold">EduClub</div>
              <div className="text-xs text-gray-500">Campus Jutiapa</div>
            </div>
          </div>

          <nav className="flex flex-col w-full gap-1">
            {items.map((it) => (
              <Link key={it.href} href={it.href} className="group flex items-center md:gap-3 px-2 py-3 rounded-lg hover:bg-violet-50">
                <span className="text-xl md:text-lg">{it.icon}</span>
                <span className="hidden md:inline-block text-sm text-gray-700 group-hover:text-violet-600">{it.label}</span>
              </Link>
            ))}
            {/* Separador entre Perfil y Cerrar sesión */}
            <div className="w-full border-t border-gray-100 my-2" />
            {/* Cerrar sesión justo debajo de Perfil */}
            <div className="group flex items-center md:gap-3 px-2 py-3 rounded-lg hover:bg-red-50">
              <span className="text-xl md:text-lg">🚪</span>
              <LogoutButton className="hidden md:inline-block text-sm text-gray-700 group-hover:text-red-600 w-full text-left">
                Cerrar sesión
              </LogoutButton>
              <div className="md:hidden ml-auto">
                <LogoutButton className="text-red-600">🔴</LogoutButton>
              </div>
            </div>
          </nav>

        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 print:p-0">{children}</main>
    </div>
  );
}
