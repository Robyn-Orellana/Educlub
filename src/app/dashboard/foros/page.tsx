import React from 'react';
import Link from 'next/link';
import { listForumThreads, createForumThread } from '../../../lib/db';
import { getServerSession } from '../../../lib/session';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export default async function Foros() {
  const threads = await listForumThreads(100);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Foros</h1>
        <p className="text-gray-600">Participa en discusiones y resuelve dudas con tutores y compañeros.</p>
      </div>

      <NewThreadForm />

      <div className="divide-y rounded border">
        {threads.length === 0 && (
          <div className="p-4 text-gray-500">Aún no hay hilos. ¡Sé el primero en publicar!</div>
        )}
        {threads.map((t) => (
          <Link key={t.id} href={`/dashboard/foros/${t.id}`} className="block p-4 hover:bg-gray-50">
            <h3 className="font-semibold text-lg">{t.title}</h3>
            <p className="text-sm text-gray-600 line-clamp-2">{t.body}</p>
            <div className="mt-2 text-xs text-gray-500">
              Por {t.author_name} • {new Date(t.created_at).toLocaleString()} • {t.comments_count} comentarios
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

async function createThread(formData: FormData) {
  'use server';
  const title = String(formData.get('title') || '').trim();
  const body = String(formData.get('body') || '').trim();
  if (!title || !body) return;
  const session = await getServerSession();
  if (!session.isAuthenticated) return;
  const link_url = String(formData.get('link_url') || '').trim();
  const attachments = [] as Array<{ kind: 'image' | 'link'; url: string; title?: string | null }>;
  if (link_url) attachments.push({ kind: 'link', url: link_url });
  const created = await createForumThread(session.userId, title, body, attachments);
  revalidatePath('/dashboard/foros');
  if (created?.id) {
    redirect(`/dashboard/foros/${created.id}`);
  }
}

function NewThreadForm() {
  return (
    <form action={createThread} className="rounded border p-4 space-y-3 bg-white">
      <h2 className="font-semibold">Crear nuevo hilo</h2>
      <input name="title" placeholder="Título" className="w-full border rounded p-2" />
      <textarea name="body" placeholder="Escribe tu pregunta o tema..." className="w-full border rounded p-2 min-h-[100px]" />
      <div className="grid grid-cols-1 gap-2">
        <input name="link_url" placeholder="Agregar link (opcional)" className="w-full border rounded p-2" />
      </div>
      <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Publicar</button>
    </form>
  );
}
