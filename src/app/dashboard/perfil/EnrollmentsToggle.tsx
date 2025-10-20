"use client";
import React, { useEffect, useState } from 'react';

type Course = { id: number; code: string; name: string };

export default function EnrollmentsToggle() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState<Course[]>([]);
  const [mine, setMine] = useState<Course[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch('/api/profile/enrollments', { cache: 'no-store' });
        const d = await r.json();
        if (!active) return;
        if (d.ok) {
          const allNorm = (d.all || []).map((c: Course) => ({ id: Number(c.id), code: String(c.code), name: String(c.name) }));
          const mineNorm = (d.mine || []).map((c: Course) => ({ id: Number(c.id), code: String(c.code), name: String(c.name) }));
          setAll(allNorm);
          setMine(mineNorm);
          setSelected(mineNorm.map((c: Course) => c.id));
        } else setError(d.error || 'Error al cargar inscripciones');
      } catch {
        if (active) setError('Error al cargar inscripciones');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false };
  }, [open]);

  function toggleId(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/enrollments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseIds: selected }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'No se pudo guardar');
      const mineNorm = (json.mine || []).map((c: Course) => ({ id: Number(c.id), code: String(c.code), name: String(c.name) }));
      setMine(mineNorm);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Gestiona los cursos a los que estás inscrito.</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
        >
          {open ? 'Cerrar' : 'Cambiar inscripciones'}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          {error && <div className="text-sm text-red-600">{error}</div>}
          {loading ? (
            <div className="text-sm text-gray-500">Cargando…</div>
          ) : (
            <>
              <div>
                <h3 className="font-semibold mb-2">Selecciona cursos</h3>
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
                    {saving ? 'Guardando…' : 'Guardar inscripciones'}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <h3 className="font-semibold mb-2">Actualmente inscrito en</h3>
                {mine.length === 0 ? (
                  <p className="text-sm text-gray-500">No estás inscrito en cursos.</p>
                ) : (
                  <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                    {mine.map((c) => (
                      <li key={c.id}>{c.code} — {c.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
