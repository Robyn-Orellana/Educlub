import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerSession } from '../../lib/session';
import { listUpcomingSessionsForUser, listForumThreads, type ForumThread } from '../../lib/db';

export const dynamic = 'force-dynamic';

export default async function DashboardHome() {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    redirect('/login');
  }

  const firstName = session.userName?.split(' ')[0] || 'Usuario';

  // Fetch data server-side
  const [upcoming, recentThreads] = await Promise.all([
    listUpcomingSessionsForUser(session.userId, 3),
    listForumThreads(3)
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Hola, {firstName} 👋</h1>
      </div>
      <p className="text-gray-600">Aquí tienes un resumen rápido de lo más reciente.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas sesiones */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Próximas sesiones</h2>
            <Link href="/dashboard/calendario" className="text-sm text-violet-600 hover:underline">Ver calendario</Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-sm text-gray-500">No tienes sesiones próximas.</div>
          ) : (
            <ul className="divide-y">
              {upcoming.map((s) => {
                const when = new Date(s.scheduled_at);
                const dateStr = when.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
                const partner = s.partner_name ?? 'Por confirmar';
                const role = s.role === 'host' ? 'Anfitrión' : 'Invitado';
                return (
                  <li key={`${s.role}-${s.session_id}`} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{s.course_code} — {s.course_name}</div>
                      <div className="text-xs text-gray-600">{dateStr} · {s.duration_min} min · {role}</div>
                      <div className="text-xs text-gray-600">Con: {partner}</div>
                    </div>
                    {s.join_url && (
                      <a href={s.join_url} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700">Unirse</a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Foros recientes */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Foros recientes</h2>
            <Link href="/dashboard/foros" className="text-sm text-violet-600 hover:underline">Ver foros</Link>
          </div>
          {recentThreads.length === 0 ? (
            <div className="text-sm text-gray-500">No hay hilos aún.</div>
          ) : (
            <ul className="divide-y">
              {recentThreads.map((t: ForumThread) => (
                <li key={t.id} className="py-3">
                  <Link href={`/dashboard/foros/${t.id}`} className="block group">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900 group-hover:underline">{t.title}</h3>
                      <span className="text-[11px] text-gray-500">{new Date(t.updated_at || t.created_at).toLocaleString('es-ES', { dateStyle: 'medium' })}</span>
                    </div>
                    <div className="text-xs text-gray-600 line-clamp-2">{t.body}</div>
                    <div className="mt-1 text-[11px] text-gray-500">Por {t.author_name} · {t.comments_count} comentario{t.comments_count === 1 ? '' : 's'}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
