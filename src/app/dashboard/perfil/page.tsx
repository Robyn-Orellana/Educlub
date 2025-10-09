import React from 'react';
import { getFirstUser, getEnrollmentsForUser, getTutorAssignments } from '../../../lib/db';

export default async function Perfil() {
  // For demo purposes we fetch the first user from the DB
  const user = await getFirstUser();
  if (!user) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Perfil</h1>
        <p className="text-gray-600">No se encontró usuario en la base de datos.</p>
      </div>
    );
  }

  const enrollments = await getEnrollmentsForUser(user.id as number);
  const tutorAssignments = await getTutorAssignments(user.id as number);

  return (
    <div>
      <div className="flex items-center gap-6 mb-6">
        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-3xl text-gray-600">{user.first_name?.[0] || 'U'}</div>
        <div>
          <h1 className="text-2xl font-bold">{user.first_name} {user.last_name}</h1>
          <p className="text-sm text-gray-500">{user.email} · <span className="capitalize">{user.role}</span></p>
          <p className="text-xs text-gray-400 mt-1">Cuenta creada: {new Date(user.created_at).toLocaleString()}</p>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Cursos inscritos</h2>
          {enrollments.length === 0 ? (
            <p className="text-gray-500">No estás inscrito en cursos.</p>
          ) : (
            <ul className="space-y-2">
              {enrollments.map((c: any) => (
                <li key={c.id} className="text-sm text-gray-700">{c.code} — {c.name}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-2">Asignaciones como tutor</h2>
          {tutorAssignments.length === 0 ? (
            <p className="text-gray-500">No estás asignado como tutor a cursos.</p>
          ) : (
            <ul className="space-y-2">
              {tutorAssignments.map((c: any) => (
                <li key={c.id} className="text-sm text-gray-700">{c.code} — {c.name}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-2">Estado de la cuenta</h3>
        <p className="text-sm text-gray-600">{user.status}</p>
      </div>
    </div>
  );
}
