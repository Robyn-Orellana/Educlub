"use client";
import React, { useEffect, useState } from 'react';

type Course = { id: number; code: string; name: string };
type SessionRow = {
  session_id: number;
  scheduled_at: string;
  duration_min: number;
  platform: string | null;
  status: string | null;
  course_code: string;
  course_name: string;
  tutor_name: string | null;
  student_name: string | null;
  join_url: string | null;
};

function formatDateTime(iso: string) {
  try { return new Date(iso).toLocaleString('es-ES'); } catch { return iso; }
}

function toCSV(rows: SessionRow[]): string {
  const header = ['ID','Fecha','Curso','Tutor','Estudiante','Enlace'];
  const lines = rows.map(r => [
    r.session_id,
    formatDateTime(r.scheduled_at),
    `${r.course_code} — ${r.course_name}`,
    r.tutor_name || '',
    r.student_name || '',
    r.join_url || ''
  ].map(v => typeof v === 'string' ? '"' + v.replaceAll('"','""') + '"' : String(v)).join(','));
  return [header.join(','), ...lines].join('\n');
}

export default function SessionsReport() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>('');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/courses');
        const d = await r.json();
        if (r.ok && d?.ok) setCourses(d.courses || []);
      } catch {}
    })();
  }, []);

  // El historial siempre es del usuario logueado; no se cargan participantes

  async function load() {
    setLoading(true); setError(null);
    try {
      const q = new URLSearchParams();
      if (courseId) q.set('course_id', courseId);
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      const r = await fetch(`/api/reports/sessions?${q.toString()}`);
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error || 'No se pudo cargar el informe');
      setRows(d.rows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sesiones_por_curso.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function printView() {
    window.print();
  }

  function clearAll() {
    setCourseId('');
    setFrom('');
    setTo('');
    setRows([]);
    setError(null);
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold print:hidden">Mi historial de sesiones</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 print:hidden">
        <label className="text-sm">
          <span className="text-gray-600">Curso</span>
          <select value={courseId} onChange={(e)=>setCourseId(e.target.value)} className="mt-1 w-full border rounded px-3 py-2">
            <option value="">Todos</option>
            {courses.map(c => <option key={c.id} value={String(c.id)}>{c.code} — {c.name}</option>)}
          </select>
        </label>
        {/* Sin selector de persona; el backend usa la sesión */}
        <label className="text-sm">
          <span className="text-gray-600">Desde</span>
          <input type="date" value={from} onChange={(e)=>setFrom(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="text-gray-600">Hasta</span>
          <input type="date" value={to} onChange={(e)=>setTo(e.target.value)} className="mt-1 w-full border rounded px-3 py-2" />
        </label>
      </div>
      <div className="flex items-center gap-2 print:hidden">
        <button onClick={clearAll} className="px-3 py-1.5 rounded border hover:bg-gray-50">Limpiar</button>
        <button onClick={load} className="px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700">Generar</button>
        <button onClick={downloadCSV} disabled={rows.length===0} className="px-3 py-1.5 rounded border hover:bg-gray-50 disabled:opacity-50">Descargar CSV</button>
        <button onClick={printView} disabled={rows.length===0} className="px-3 py-1.5 rounded border hover:bg-gray-50 disabled:opacity-50">Imprimir</button>
      </div>
      {error && <div className="text-sm text-red-600 print:hidden">{error}</div>}
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2">Fecha</th>
              <th className="py-2">Curso</th>
              <th className="py-2">Tutor</th>
              <th className="py-2">Estudiante</th>
              <th className="py-2">Enlace</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.session_id} className="border-t">
                <td className="py-2">{formatDateTime(r.scheduled_at)}</td>
                <td className="py-2">{r.course_code} — {r.course_name}</td>
                <td className="py-2">{r.tutor_name || '—'}</td>
                <td className="py-2">{r.student_name || '—'}</td>
                <td className="py-2">
                  {r.join_url ? (
                    <a className="text-violet-600 hover:underline print:text-black" href={r.join_url} target="_blank" rel="noreferrer">Abrir</a>
                  ) : '—'}
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-500">Sin datos</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
