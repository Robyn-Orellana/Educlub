"use client";
import React, { useEffect, useMemo, useState } from 'react';
import RatingStars from '../perfil/RatingStars';

// Tipos simples para usuarios y cursos
type UserRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: 'student' | 'tutor' | string;
};

type CourseRow = {
  id: number;
  code: string;
  name: string;
};

type UserWithCourses = UserRow & { courses: CourseRow[]; avg?: number; total?: number };

export default function RatingsList() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserWithCourses[]>([]);
  const [me, setMe] = useState<{ id: number } | null>(null);
  const [role, setRole] = useState<'all' | 'tutor' | 'student'>('all');

  // Carga usuarios (tutores/estudiantes) y sus cursos
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rSession = await fetch('/api/auth/session');
        const dSession = await rSession.json();
        if (rSession.ok && dSession?.isAuthenticated) setMe({ id: Number(dSession.userId) });

        const rUsers = await fetch(`/api/users/list?role=${encodeURIComponent(role)}`);
        const dUsers = await rUsers.json();
        if (!rUsers.ok || !dUsers?.ok) throw new Error(dUsers.error || 'No se pudo cargar usuarios');
        setUsers(dUsers.users || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar la lista');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  const [ratingTarget, setRatingTarget] = useState<UserWithCourses | null>(null);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState('');
  const busy = useMemo(() => loading, [loading]);

  async function submitRating() {
    if (!ratingTarget) return;
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ratee_id: ratingTarget.id, score, comment: comment || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'No se pudo calificar');
      // Actualizar promedio localmente (suma simple)
      setUsers((prev) => prev.map((u) => u.id === ratingTarget.id ? {
        ...u,
        avg: u.total ? ((u.avg || 0) * (u.total || 0) + score) / ((u.total || 0) + 1) : score,
        total: (u.total || 0) + 1,
      } : u));
      setRatingTarget(null);
      setScore(5);
      setComment('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al calificar');
    }
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-600">{error}</div>}
      {busy && <div className="text-sm text-gray-500">Cargando…</div>}
      {!busy && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2">Usuario</th>
              <th className="py-2">Correo</th>
              <th className="py-2">Rol</th>
              <th className="py-2">Cursos</th>
              <th className="py-2">Rating</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="py-2">{u.first_name} {u.last_name}</td>
                <td className="py-2 text-gray-600">{u.email}</td>
                <td className="py-2">
                  <span className="capitalize">{u.role}</span>
                </td>
                <td className="py-2 text-gray-600">
                  {u.courses.length === 0 ? <span className="text-gray-400">—</span> : u.courses.map((c) => c.code).join(', ')}
                </td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <RatingStars value={u.avg || 0} size="sm" />
                    <span className="text-xs text-gray-500">({u.total || 0})</span>
                  </div>
                </td>
                <td className="py-2">
                  {me?.id !== u.id && (
                    <button onClick={() => setRatingTarget(u)} className="px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700">Calificar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="fixed bottom-6 right-6">
        <div className="bg-white/90 backdrop-blur rounded-full shadow border p-1 flex items-center gap-1">
          <button onClick={() => setRole('all')} className={`px-3 py-1.5 rounded-full text-sm ${role==='all'?'bg-violet-600 text-white':'hover:bg-gray-100'}`}>Todos</button>
          <button onClick={() => setRole('tutor')} className={`px-3 py-1.5 rounded-full text-sm ${role==='tutor'?'bg-violet-600 text-white':'hover:bg-gray-100'}`}>Tutores</button>
          <button onClick={() => setRole('student')} className={`px-3 py-1.5 rounded-full text-sm ${role==='student'?'bg-violet-600 text-white':'hover:bg-gray-100'}`}>Estudiantes</button>
        </div>
      </div>

      {ratingTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Calificar a {ratingTarget.first_name} {ratingTarget.last_name}</h3>
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-gray-600">Puntaje</span>
                <select className="mt-1 w-full border rounded px-3 py-2" value={score} onChange={(e) => setScore(Number(e.target.value))}>
                  {[5,4,3,2,1].map((s) => <option key={s} value={s}>{s} ⭐</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">Comentario (opcional)</span>
                <textarea className="mt-1 w-full border rounded px-3 py-2" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRatingTarget(null)} className="px-3 py-1.5 rounded border border-gray-200 hover:bg-gray-100">Cancelar</button>
              <button onClick={submitRating} className="px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
