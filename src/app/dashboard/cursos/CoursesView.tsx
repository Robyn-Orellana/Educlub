"use client";

import React, { useMemo, useState } from 'react';
import type { Course } from '../../../lib/db';

function chunkArray<T>(arr: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export default function CoursesView({ courses }: { courses: Course[] }) {
  const groups = useMemo(() => chunkArray(courses, 5), [courses]);
  const [active, setActive] = useState(0);

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
          <table className="w-full table-auto min-w-[720px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Código</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Tutor</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Inscritos</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Sesiones</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {groups[active]?.map((c) => (
                <tr key={c.code} className="border-t last:border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{c.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-800">{c.name}<div className="text-xs text-gray-500">{c.description}</div></td>
                  <td className="px-4 py-3 text-sm text-gray-700">{c.tutor || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{c.inscritos ?? 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{c.sesiones ?? 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">{c.promedio_estrellas ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
