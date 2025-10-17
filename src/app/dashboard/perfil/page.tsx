import React from 'react';
import { getEnrollmentsForUser } from '../../../lib/db';
import { getServerSession } from '../../../lib/session';
import ProfileEditor from './ProfileEditor';
import TutorCoursesManager from './TutorCoursesManager';

type SimpleCourse = { id: number; code: string; name: string };

export const dynamic = 'force-dynamic';

export default async function Perfil() {
  // Obtener la sesión actual
  const session = await getServerSession();
  
  if (!session.isAuthenticated) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Perfil</h1>
        <p className="text-gray-600">No has iniciado sesión.</p>
      </div>
    );
  }
  
  const userId = session.userId;
  const enrollments = (await getEnrollmentsForUser(userId)) as SimpleCourse[];

  return (
    <div>
      <div className="flex items-center gap-6 mb-6">
        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-3xl text-gray-600">{session.userName?.[0] || 'U'}</div>
        <div>
          <h1 className="text-2xl font-bold">{session.userName}</h1>
          <p className="text-sm text-gray-500">{session.userEmail} · <span className="capitalize">{session.userRole}</span></p>
          <p className="text-xs text-gray-400 mt-1">Usuario autenticado</p>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg p-4 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold mb-3">Editar perfil</h2>
          <ProfileEditor />
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Cursos inscritos</h2>
          {enrollments.length === 0 ? (
            <p className="text-gray-500">No estás inscrito en cursos.</p>
          ) : (
            <ul className="space-y-2">
              {enrollments.map((c: SimpleCourse) => (
                <li key={c.id} className="text-sm text-gray-700">{c.code} — {c.name}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6 bg-white rounded-lg p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Inscribirse para impartir cursos</h2>
        <p className="text-sm text-gray-600 mb-3">Selecciona los cursos que deseas impartir como tutor.</p>
        <TutorCoursesManager />
      </section>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Estado de la cuenta</h3>
        <p className="text-sm text-gray-600">Activo</p>
      </div>
    </div>
  );
}
