"use client";

import React, { useEffect, useMemo, useState } from 'react';
import type { Course } from '../../../lib/db';

type APIUser = {
  id: number;
  name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
};

function chunkArray<T>(arr: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export default function CoursesView({ courses }: { courses: Course[] }) {
  const groups = useMemo(() => chunkArray(courses, 5), [courses]);
  const [active, setActive] = useState(0);
  // Mapa de código de curso -> lista de tutores (nombres)
  const [tutorsByCode, setTutorsByCode] = useState<Record<string, string[]>>({});
  const [loadingCodes, setLoadingCodes] = useState<Record<string, boolean>>({});

  // Cargar tutores para los cursos visibles del grupo activo
  useEffect(() => {
    const current = groups[active] || [];
    let cancelled = false;

    async function loadTutorsFor(code: string) {
      try {
        setLoadingCodes((prev) => ({ ...prev, [code]: true }));
        const res = await fetch(`/api/course-participants?course_code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!cancelled && res.ok && data?.ok) {
          const names: string[] = Array.isArray(data.tutors)
            ? (data.tutors as APIUser[])
                .map((t) => {
                  // API devuelve { id, name, email }; fallback a first/last por compatibilidad
                  if (t && typeof t.name === 'string' && t.name.trim()) return t.name.trim();
                  const fn = t?.first_name ?? '';
                  const ln = t?.last_name ?? '';
                  const full = `${fn} ${ln}`.trim();
                  return full || undefined;
                })
                .filter((x): x is string => typeof x === 'string' && x.length > 0)
            : [];
          setTutorsByCode((prev) => ({ ...prev, [code]: names }));
        }
      } catch {
        // noop
      } finally {
        if (!cancelled) setLoadingCodes((prev) => ({ ...prev, [code]: false }));
      }
    }

    // Disparar cargas sólo para cursos que no estén ya en caché
    current.forEach((c) => {
      if (!tutorsByCode[c.code] && !loadingCodes[c.code]) {
        loadTutorsFor(c.code);
      }
    });

    return () => { cancelled = true; };
  }, [active, groups, tutorsByCode, loadingCodes]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Cursos por semestre</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {groups.map((g, idx) => (
          <button
            key={idx}
            onClick={() => setActive(idx)}
            className={`text-left p-4 rounded-lg border transition-shadow hover:shadow-md ${active === idx ? 'bg-violet-50 border-violet-200' : 'bg-white border-gray-100'}`}
            aria-pressed={active === idx}
            aria-label={`Semestre ${idx + 1}`}
          >
            <div className="text-sm text-gray-500">Semestre {idx + 1}</div>
            <div className="mt-2 text-sm text-gray-800 font-semibold">{g.length} cursos</div>
            <div className="text-xs text-gray-400 mt-1">Códigos: {g[0]?.code} — {g[g.length - 1]?.code}</div>
          </button>
        ))}
      </div>

      <section>
        <h2 className="text-lg font-semibold mt-2 mb-3">Semestre {active + 1}</h2>
        <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
          <table className="w-full table-auto min-w-[680px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Código</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tutores</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Inscritos</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Sesiones</th>
              </tr>
            </thead>
            <tbody>
              {groups[active]?.map((c) => (
                <tr key={c.code} className="border-t last:border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{c.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{c.name}<div className="text-xs text-gray-500">{c.description}</div></td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {(() => {
                      const serverNames = Array.isArray(c.tutors) && c.tutors.length > 0 ? (c.tutors as string[]) : undefined;
                      const names = serverNames ?? tutorsByCode[c.code];
                      if (names && names.length > 0) return names.join(', ');
                      if (loadingCodes[c.code]) return 'Cargando…';
                      // Fallback al tutor singular si existiera en los datos
                      return c.tutor || '—';
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{c.inscritos ?? 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{c.sesiones ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
