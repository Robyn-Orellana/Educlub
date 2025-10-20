"use client";
import React, { useEffect, useMemo, useState } from 'react';
import type { PresignResourceResponse } from '../../../lib/types/resources';

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
  // Ensure current first
  const cur = `${currentYear}-${currentHalf}`;
  out.sort((a, b) => (a === cur ? -1 : b === cur ? 1 : b.localeCompare(a)));
  return Array.from(new Set(out));
}

export default function UploadResourceForm({ onUploaded }: { onUploaded?: () => void }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [semester, setSemester] = useState<string>(buildSemesterOptions()[0] ?? '');
  const [courseId, setCourseId] = useState<number | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCourse = useMemo(() => courses.find((c) => c.id === Number(courseId)), [courses, courseId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingCourses(true);
        const res = await fetch('/api/courses');
        const json = await res.json();
        if (!cancelled && json?.ok && Array.isArray(json.courses)) {
          setCourses(json.courses);
        }
      } catch (e) {
        console.error('Error fetching courses', e);
      } finally {
        if (!cancelled) setLoadingCourses(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) { setError('Selecciona un archivo'); return; }
    if (!semester) { setError('Selecciona un semestre'); return; }
    if (!courseId || !selectedCourse) { setError('Selecciona un curso'); return; }
    if (!title.trim()) { setError('Ingresa un título'); return; }
    try {
      setBusy(true);
      // 1) Presign
      const preRes = await fetch('/api/resources/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semester,
          courseId: Number(courseId),
          courseCode: selectedCourse.code,
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
        }),
      });
      const preJson: PresignResourceResponse = await preRes.json();
      if (!preRes.ok || !('ok' in preJson) || !preJson.ok) {
        const errMsg = (preJson && typeof preJson === 'object' && 'error' in preJson) ? String((preJson as { error?: unknown }).error || '') : '';
        throw new Error(errMsg || 'No se pudo preparar la subida');
      }
      const { url, key, publicUrl } = preJson;

      // 2) Upload file to S3
      const putRes = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      if (!putRes.ok) {
        throw new Error('Fallo al subir el archivo');
      }

      // 3) Finalize (save metadata in Firestore)
      const finRes = await fetch('/api/resources/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semester,
          courseId: Number(courseId),
          courseCode: selectedCourse.code,
          courseName: selectedCourse.name,
          title: title.trim(),
          description: description.trim() || undefined,
          originalName: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          storageKey: key,
          publicUrl,
        }),
      });
  const finJson: { ok: boolean; error?: string } = await finRes.json();
      if (!finRes.ok || !finJson?.ok) {
        throw new Error(finJson?.error || 'No se pudo registrar el recurso');
      }

      // Reset and notify
      setFile(null);
      setTitle('');
      setDescription('');
      if (onUploaded) onUploaded();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-md bg-white">
      <div>
        <label className="block text-sm font-medium mb-1">Semestre</label>
        <select className="border rounded px-2 py-1 w-full" value={semester} onChange={(e) => setSemester(e.target.value)}>
          {buildSemesterOptions().map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Curso</label>
        <select className="border rounded px-2 py-1 w-full" value={courseId} onChange={(e) => setCourseId(Number(e.target.value))} disabled={loadingCourses}>
          <option value="">{loadingCourses ? 'Cargando cursos...' : 'Selecciona un curso'}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Archivo</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file && <p className="text-xs text-gray-500 mt-1">{file.name} — {(file.size/1024/1024).toFixed(2)} MB</p>}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Título</label>
        <input className="border rounded px-2 py-1 w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Guía de ejercicios 1" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Descripción (opcional)</label>
        <textarea className="border rounded px-2 py-1 w-full" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60" disabled={busy}>
        {busy ? 'Subiendo…' : 'Subir recurso'}
      </button>
    </form>
  );
}
