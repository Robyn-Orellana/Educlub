"use client";
import React, { useEffect, useMemo, useState } from 'react';

type Course = { id: number; code: string; name: string };
type Person = { id: number; name: string; email: string };
type PrintRow = { courseCode: string; courseName: string; role: 'Tutor' | 'Estudiante'; name: string; email: string };

export default function ParticipantsReport() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseCode, setCourseCode] = useState<string>('');
  const [allCourses, setAllCourses] = useState<boolean>(false);
  const [tutors, setTutors] = useState<Person[]>([]);
  const [students, setStudents] = useState<Person[]>([]);
  const [printRows, setPrintRows] = useState<PrintRow[]>([]);
  const [loading, setLoading] = useState(false);
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

  const courseNameByCode = useMemo(() => Object.fromEntries(courses.map(c => [c.code, c.name])), [courses]);

  async function loadSingle(code: string) {
    const r = await fetch(`/api/course-participants?course_code=${encodeURIComponent(code)}`);
    const d = await r.json();
    if (!r.ok || !d?.ok) throw new Error(d?.error || 'No se pudo cargar participantes');
    const cname = courseNameByCode[code] || code;
    const rows: PrintRow[] = [
      ...(d.tutors || []).map((t: Person) => ({ courseCode: code, courseName: cname, role: 'Tutor' as const, name: t.name, email: t.email })),
      ...(d.students || []).map((s: Person) => ({ courseCode: code, courseName: cname, role: 'Estudiante' as const, name: s.name, email: s.email })),
    ];
    return { tutors: d.tutors || [], students: d.students || [], rows } as { tutors: Person[]; students: Person[]; rows: PrintRow[] };
  }

  async function load() {
    setLoading(true); setError(null);
    try {
      if (allCourses) {
        const allRows: PrintRow[] = [];
        for (const c of courses) {
          try {
            const res = await loadSingle(c.code);
            allRows.push(...res.rows);
          } catch {
            // continuar con los demás cursos
          }
        }
        setPrintRows(allRows.sort((a,b) => a.courseCode.localeCompare(b.courseCode) || a.role.localeCompare(b.role) || a.name.localeCompare(b.name)));
        // Limpiar panel de vista en pantalla (se imprime desde printRows)
        setTutors([]); setStudents([]);
      } else {
        if (!courseCode) { setTutors([]); setStudents([]); setPrintRows([]); return; }
        const { tutors, students, rows } = await loadSingle(courseCode);
        setTutors(tutors);
        setStudents(students);
        setPrintRows(rows);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
      setTutors([]); setStudents([]); setPrintRows([]);
    } finally { setLoading(false); }
  }

  function printView() { window.print(); }

  function clearAll() {
    setCourseCode('');
    setAllCourses(false);
    setTutors([]);
    setStudents([]);
    setPrintRows([]);
    setError(null);
  }

  return (
    <div className="space-y-3">
      {/* Pantalla (oculto en impresión) */}
      <div className="print:hidden space-y-3">
        <h2 className="text-lg font-semibold">Participantes por curso</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="text-gray-600">Curso</span>
            <select value={courseCode} onChange={(e)=>setCourseCode(e.target.value)} disabled={allCourses} className="mt-1 w-full border rounded px-3 py-2">
              <option value="">Seleccionar</option>
              {courses.map(c => <option key={c.id} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </label>
          <label className="text-sm flex items-end gap-2">
            <input id="all-courses" type="checkbox" className="accent-violet-600" checked={allCourses} onChange={(e)=>setAllCourses(e.target.checked)} />
            <span>Todos los cursos</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearAll} className="px-3 py-1.5 rounded border hover:bg-gray-50">Limpiar</button>
          <button onClick={load} className="px-3 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700" disabled={loading || (!allCourses && !courseCode)}>Generar</button>
          <button onClick={printView} className="px-3 py-1.5 rounded border hover:bg-gray-50 disabled:opacity-50" disabled={loading || printRows.length===0}>Imprimir</button>
        </div>
        {error && <div className="text-sm text-red-600">{error}</div>}

        {/* Vista en pantalla (no se imprime) */}
        {!allCourses && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">Tutores ({tutors.length})</h3>
              <ul className="divide-y border rounded">
                {tutors.map(t => (
                  <li key={t.id} className="p-3">
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-gray-600">{t.email}</div>
                  </li>
                ))}
                {tutors.length===0 && <li className="p-3 text-gray-500">—</li>}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Estudiantes ({students.length})</h3>
              <ul className="divide-y border rounded">
                {students.map(s => (
                  <li key={s.id} className="p-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-gray-600">{s.email}</div>
                  </li>
                ))}
                {students.length===0 && <li className="p-3 text-gray-500">—</li>}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Área de impresión minimalista */}
      <div className="hidden print:block" id="print-area">
        <h1 className="text-xl font-semibold mb-2">Participantes</h1>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2">Curso</th>
              <th className="py-2">Rol</th>
              <th className="py-2">Nombre</th>
              <th className="py-2">Correo</th>
            </tr>
          </thead>
          <tbody>
            {printRows.map((r,idx) => (
              <tr key={idx} className="border-t">
                <td className="py-1">{r.courseCode} — {r.courseName}</td>
                <td className="py-1">{r.role}</td>
                <td className="py-1">{r.name}</td>
                <td className="py-1">{r.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
