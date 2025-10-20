"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResourceItem } from '../../../lib/types/resources';

type Course = { id: number; code: string; name: string };

function buildSemesterOptions(): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentHalf = now.getMonth() < 6 ? 1 : 2;
  const out: string[] = [];
  for (let y = currentYear; y >= currentYear - 3; y--) {
    out.push(`${y}-1`);
    out.push(`${y}-2`);
  }
  const cur = `${currentYear}-${currentHalf}`;
  out.sort((a, b) => (a === cur ? -1 : b === cur ? 1 : b.localeCompare(a)));
  return Array.from(new Set(out));
}

export default function ResourcesList() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [semester, setSemester] = useState<string>(buildSemesterOptions()[0] ?? '');
  const [courseCode, setCourseCode] = useState<string>('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingCourses(true);
        const res = await fetch('/api/courses');
        const json = await res.json();
        if (!cancelled && json?.ok && Array.isArray(json.courses)) {
          setCourses(json.courses);
          if (json.courses[0]) setCourseCode(json.courses[0].code);
        }
      } catch (e) {
        console.error('Error fetching courses', e);
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    if (!semester || !courseCode) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/resources/list?semester=${encodeURIComponent(semester)}&courseCode=${encodeURIComponent(courseCode)}`);
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Error al cargar recursos');
      setResources(json.resources);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [semester, courseCode]);

  useEffect(() => { load(); }, [semester, courseCode, load]);

  const grouped = useMemo(() => {
    const map = new Map<string, ResourceItem[]>();
    for (const r of resources) {
      const key = r.courseCode;
      const arr = map.get(key) ?? [];
      arr.push(r);
      map.set(key, arr);
    }
    return map;
  }, [resources]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Semestre</label>
          <select className="border rounded px-2 py-1" value={semester} onChange={(e) => setSemester(e.target.value)}>
            {buildSemesterOptions().map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Curso</label>
          <select className="border rounded px-2 py-1" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} disabled={loadingCourses}>
            {loadingCourses && <option value="">Cargando…</option>}
            {!loadingCourses && courses.map((c) => (
              <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>
        <button className="ml-auto bg-gray-200 px-3 py-2 rounded" onClick={load} disabled={loading}>Refrescar</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([code, items]) => (
            <div key={code}>
              <h3 className="text-lg font-semibold mb-2">{code}</h3>
              <ul className="divide-y border rounded">
                {items.map((r) => (
                  <li key={r.id} className="p-3 flex items-start gap-3">
                    <div className="flex-1">
                      <div className="font-medium">{r.title}</div>
                      {r.description && <div className="text-sm text-gray-600">{r.description}</div>}
                      <div className="text-xs text-gray-500 mt-1">
                        Subido por {r.userName || r.userId} — {(new Date(r.createdAt)).toLocaleString()} — {r.originalName}
                      </div>
                    </div>
                    <div>
                      <a href={r.publicUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Ver/Descargar</a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {resources.length === 0 && <p className="text-gray-500">No hay recursos para el filtro seleccionado.</p>}
        </div>
      )}
    </div>
  );
}
