"use client";
import React, { useEffect, useState } from 'react';

type Course = { id: number; code: string; name: string };

export default function TutorCoursesManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState<Course[]>([]);
  const [mine, setMine] = useState<Course[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/profile/tutor-courses', { cache: 'no-store' });
        const json = await res.json();
        if (!active) return;
        if (json.ok) {
          setAll((json.all || []).map((c: { id: number; code: string; name: string }) => ({ id: Number(c.id), code: String(c.code), name: String(c.name) })));
          const mineNorm = (json.mine || []).map((c: { id: number; code: string; name: string }) => ({ id: Number(c.id), code: String(c.code), name: String(c.name) }));
          setMine(mineNorm);
          setSelected(mineNorm.map((c: Course) => c.id));
        } else setError(json.error || 'Error al cargar cursos');
      } catch (_e) {
        if (active) setError('Error al cargar cursos');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false };
  }, []);

  function toggleId(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/tutor-courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds: selected }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'No se pudo guardar');
      const mineNorm = (json.mine || []).map((c: { id: number; code: string; name: string }) => ({ id: Number(c.id), code: String(c.code), name: String(c.name) }));
      setMine(mineNorm);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Cargando…</div>;
  return (
    <div className="space-y-3">
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div>
        <h3 className="font-semibold mb-2">Selecciona cursos para impartir</h3>
        <div className="max-h-64 overflow-auto border rounded p-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {all.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-blue-600"
                checked={selected.includes(c.id)}
                onChange={() => toggleId(c.id)}
              />
              <span className="text-gray-700">{c.code} — {c.name}</span>
            </label>
          ))}
        </div>
        <div className="mt-3">
          <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar selección'}
          </button>
        </div>
      </div>

      <div className="pt-2">
        <h3 className="font-semibold mb-2">Actualmente impartes</h3>
        {mine.length === 0 ? (
          <p className="text-sm text-gray-500">No estás asignado como tutor actualmente.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
            {mine.map((c) => (
              <li key={c.id}>{c.code} — {c.name}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
