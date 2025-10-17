import React from 'react';
import { getEnrollmentsForUser } from '../../../lib/db';
import { getServerSession } from '../../../lib/session';
import ProfileEditor from './ProfileEditor';
import TutorCoursesManager from './TutorCoursesManager';
import RatingStars from './RatingStars';
import { sql } from '../../../lib/db';

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
  // Obtener resumen de calificaciones del usuario (como rateado)
  let rating: { avg: number; total: number } = { avg: 0, total: 0 };
  let recentRatings: { id: number; score: number; comment: string | null; created_at: string; rater_name: string }[] = [];
  try {
    const ratingSummary = await sql<{ avg: number; total: number }>`
      SELECT COALESCE(ROUND(AVG(score)::numeric, 2), 0)::float AS avg, COUNT(*)::int AS total
      FROM ratings WHERE ratee_id = ${userId};
    `;
    rating = ratingSummary?.[0] ?? { avg: 0, total: 0 };
    recentRatings = await sql<{ id: number; score: number; comment: string | null; created_at: string; rater_name: string }>`
      SELECT r.id, r.score, r.comment, r.created_at, (u.first_name || ' ' || u.last_name) AS rater_name
      FROM ratings r JOIN users u ON u.id = r.rater_id
      WHERE r.ratee_id = ${userId}
      ORDER BY r.created_at DESC
      LIMIT 5;
    `;
  } catch (e) {
    console.warn('Ratings no disponible aún (¿ejecutaste sql/ratings.sql?):', e instanceof Error ? e.message : String(e));
  }

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

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="text-lg font-semibold mb-2">Calificaciones</h3>
          <div className="flex items-center gap-2 mb-2">
            <RatingStars value={rating.avg} />
            <span className="text-sm text-gray-600">{rating.avg?.toFixed?.(2) ?? '0.00'} / 5 · {rating.total} reseña{rating.total === 1 ? '' : 's'}</span>
          </div>
          <div className="space-y-2">
            {recentRatings.length === 0 ? (
              <div className="text-sm text-gray-500">Aún no tienes reseñas.</div>
            ) : (
              recentRatings.map((r) => (
                <div key={r.id} className="border border-gray-100 rounded p-2">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm text-gray-800">{r.rater_name || 'Usuario'}</div>
                    <RatingStars value={r.score} size="sm" />
                  </div>
                  {r.comment && <div className="text-sm text-gray-700 mt-1">{r.comment}</div>}
                  <div className="text-[11px] text-gray-500 mt-1">{new Date(r.created_at).toLocaleString('es-ES')}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-2">Estado de la cuenta</h3>
        <p className="text-sm text-gray-600">Activo</p>
      </div>
    </div>
  );
}
