"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Course = { id: number; code: string; name: string };

export default function RegisterForm({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [role, setRole] = useState<'student' | 'tutor'>('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enrollCourseIds, setEnrollCourseIds] = useState<number[]>([]);
  const [tutorCourseIds, setTutorCourseIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const toggle = (list: number[], id: number, setter: (v: number[]) => void) => {
    if (list.includes(id)) setter(list.filter(x => x !== id));
    else setter([...list, id]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          first_name: firstName,
          last_name: lastName,
          email,
          password,
          enroll_course_ids: role === 'student' ? enrollCourseIds : [],
          tutor_course_ids: role === 'tutor' ? tutorCourseIds : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar');
      setSuccess('Cuenta creada correctamente. Ahora puedes iniciar sesión.');
      setTimeout(() => router.push('/login'), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">Rol</label>
          <select value={role} onChange={(e) => setRole(e.target.value as 'student' | 'tutor')} className="w-full border rounded px-3 py-2">
            <option value="student">Estudiante</option>
            <option value="tutor">Tutor</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Correo</label>
          <input type="email" className="w-full border rounded px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Nombre</label>
          <input className="w-full border rounded px-3 py-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Apellido</label>
          <input className="w-full border rounded px-3 py-2" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">Contraseña</label>
          <input type="password" className="w-full border rounded px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
      </div>

      {role === 'student' && (
        <div>
          <h3 className="font-semibold mb-2">Cursos para inscribirse</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-auto border rounded p-2">
            {courses.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={enrollCourseIds.includes(c.id)} onChange={() => toggle(enrollCourseIds, c.id, setEnrollCourseIds)} />
                <span>{c.code} — {c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {role === 'tutor' && (
        <div>
          <h3 className="font-semibold mb-2">Cursos para asignarse como tutor</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-auto border rounded p-2">
            {courses.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={tutorCourseIds.includes(c.id)} onChange={() => toggle(tutorCourseIds, c.id, setTutorCourseIds)} />
                <span>{c.code} — {c.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={isLoading} className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-2 rounded disabled:opacity-60">{isLoading ? 'Creando...' : 'Crear cuenta'}</button>
        <button type="button" onClick={() => router.push('/login')} className="border px-6 py-2 rounded">Ir a login</button>
      </div>
    </form>
  );
}
