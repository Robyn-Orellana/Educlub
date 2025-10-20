"use client";
import React, { useEffect, useState } from 'react';

type Profile = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: 'Estudiante' | 'Tutor' | string;
  avatar_url: string | null;
};

export default function ProfileEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/profile', { cache: 'no-store' });
        const json = await res.json();
        if (!active) return;
        if (json.ok) setProfile(json.profile as Profile);
        else setError(json.error || 'Error al cargar perfil');
      } catch (_e) {
        if (active) setError('Error al cargar perfil');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
          role: profile.role === 'tutor' ? 'tutor' : 'student',
          avatar_url: profile.avatar_url ?? null,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'Error al guardar');
      setProfile(json.profile as Profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Cargando perfil…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!profile) return null;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-3xl text-gray-600">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span>{profile.first_name?.[0] || 'U'}</span>
          )}
        </div>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-gray-600">Nombre</span>
            <input className="mt-1 w-full border rounded px-3 py-2"
              value={profile.first_name}
              onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Apellido</span>
            <input className="mt-1 w-full border rounded px-3 py-2"
              value={profile.last_name}
              onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Rol</span>
            <select className="mt-1 w-full border rounded px-3 py-2"
              value={profile.role === 'tutor' ? 'tutor' : 'student'}
              onChange={(e) => setProfile({ ...profile, role: (e.target.value as 'student' | 'tutor') })}
            >
              <option value="student">Estudiante</option>
              <option value="tutor">Tutor</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-gray-600">URL del ícono (avatar)</span>
            <input className="mt-1 w-full border rounded px-3 py-2"
              placeholder="https://…"
              value={profile.avatar_url ?? ''}
              onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value || null })}
            />
          </label>
        </div>
      </div>

      <div className="pt-2 flex gap-3">
        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
