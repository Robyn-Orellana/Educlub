import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/session';
import LogoutButton from '../components/LogoutButton';

export default async function DashboardHome() {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    redirect('/login');
  }

  const firstName = session.userName?.split(' ')[0] || 'Usuario';
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold mb-4">Hola, {firstName} 👋</h1>
        <LogoutButton />
      </div>
      <p className="text-gray-600">Bienvenido a EduClub. Selecciona un módulo desde la cinta lateral.</p>
    </div>
  );
}
