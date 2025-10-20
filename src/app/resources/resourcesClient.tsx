"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AuthButton from '../../components/AuthButton';
import ResourceUploader from '../../components/ResourceUploader';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getClientAuth, ensureAppCheck } from '../../lib/firebase';
import { fetchResourcesPage, formatBytes, type ResourceDoc } from '../../lib/resources';

type SimpleCourse = { id: number; code: string; name: string };

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function ResourcesClient() {
  const [user, setUser] = useState<User | null>(null);
  const [semesterId, setSemesterId] = useState<string>('1'); // Semestres 1..10
  const [courseId, setCourseId] = useState<string>(''); // course code

  const [allCourses, setAllCourses] = useState<SimpleCourse[]>([]);
  const courseGroups = useMemo(() => chunkArray(allCourses.slice(0, 50), 5), [allCourses]);

  const [items, setItems] = useState<ResourceDoc[]>([]);
  const lastRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    ensureAppCheck();
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u: User | null) => setUser(u));
  }, []);

  // (Diagnóstico eliminado)

  // Cargar cursos reales y preparar grupos (10 semestres x 5 cursos)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/courses');
        const data: { ok: boolean; courses: Array<{ id: number | string; code: string; name: string }> } = await res.json();
        if (res.ok && data?.ok && Array.isArray(data.courses)) {
          const list: SimpleCourse[] = data.courses.map((c) => ({ id: Number(c.id), code: String(c.code), name: String(c.name) }));
          setAllCourses(list);
          // Inicializar selección por defecto
          const firstGroup = chunkArray(list.slice(0, 50), 5)[0] || [];
          setSemesterId('1');
          setCourseId(firstGroup[0]?.code ?? '');
        }
      } catch {}
    })();
  }, []);

  // Cuando cambia el semestre, seleccionar el primer curso de ese grupo
  useEffect(() => {
    const idx = Math.max(0, Math.min(9, Number(semesterId) - 1));
    const group = courseGroups[idx] || [];
    if (group.length > 0) {
      if (!courseId || !group.some((c) => c.code === courseId)) setCourseId(group[0].code);
    } else {
      setCourseId('');
    }
  }, [semesterId, courseGroups]);

  const load = useCallback(async (reset = true) => {
    if (!semesterId || !courseId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetchResourcesPage({ semesterId, courseId, pageSize: 20, after: reset ? null : lastRef.current });
      if (reset) {
        setItems(res.items);
      } else {
        setItems((prev) => [...prev, ...res.items]);
      }
      lastRef.current = res.last;
      setHasMore(!!res.last);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [semesterId, courseId]);
  useEffect(() => { load(true); }, [semesterId, courseId, load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <AuthButton />
        <div className="ml-auto flex items-end gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Semestre</label>
            <select className="border rounded px-2 py-1" value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
              {Array.from({ length: 10 }).map((_, i) => {
                const val = String(i + 1);
                return (
                  <option key={val} value={val}>Semestre {val}</option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Curso</label>
            <select className="border rounded px-2 py-1" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {(() => {
                const idx = Math.max(0, Math.min(9, Number(semesterId) - 1));
                const group = courseGroups[idx] || [];
                return group.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ));
              })()}
            </select>
          </div>
          <button className="border rounded px-3 py-2" onClick={() => load(true)} disabled={loading}>Refrescar</button>
        </div>
      </div>

      {user && semesterId && courseId && (
        <ResourceUploader
          semesterId={semesterId}
          courseId={courseId}
          uploaderId={user.uid}
          roleAtUpload={undefined}
          uploaderName={user.displayName || null}
          uploaderEmail={user.email || null}
        />
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Listado</h2>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {items.length === 0 && !loading && <div className="text-gray-500">No hay recursos.</div>}
        <ul className="divide-y border rounded">
          {items.map((it) => (
            <li key={it.id} className="p-3 flex items-start gap-4">
              <div className="flex-1">
                <div className="font-medium">{it.title}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {formatBytes(it.size)} • {new Date(it.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <a href={it.downloadURL} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Descargar</a>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <button onClick={() => load(false)} disabled={!hasMore || loading} className="px-3 py-2 rounded border disabled:opacity-60">Cargar más</button>
          {loading && <span className="text-sm text-gray-600">Cargando…</span>}
        </div>
      </div>
    </div>
  );
}
