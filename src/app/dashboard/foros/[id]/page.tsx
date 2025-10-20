import React from 'react';
import Link from 'next/link';
import { addForumComment, getForumThread, listForumComments } from '../../../../lib/db';
import { getServerSession } from '../../../../lib/session';
import { revalidatePath } from 'next/cache';
import CommentsTree from '../CommentsTree';
import ThreadLikeButton from '../ThreadLikeButton';

type Props = { params: Promise<{ id: string }> };

export default async function ThreadPage({ params }: Props) {
  const { id } = await params;
  const idNum = Number(id);
  const session = await getServerSession();
  const thread = await getForumThread(idNum, session?.userId || undefined);
  if (!thread) {
    return (
      <div>
        <p className="text-red-600">Hilo no encontrado.</p>
        <Link
          href="/dashboard/foros"
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          ← Volver a foros
        </Link>
      </div>
    );
  }
  const comments = await listForumComments(idNum, session?.userId || undefined);
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-2">{thread.title}</h1>
          <div className="text-sm text-gray-500">Por {thread.author_name} • {new Date(thread.created_at).toLocaleString()}</div>
        </div>
        <Link
          href="/dashboard/foros"
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          ← Volver a foros
        </Link>
      </div>
      <article className="rounded border p-4 bg-white whitespace-pre-wrap">
        {thread.body}
        {thread.attachments && thread.attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {thread.attachments.map((a: { id: number; kind: 'image' | 'link'; url: string; title?: string | null }) => (
              <Attachment key={a.id} kind={a.kind} url={a.url} title={a.title || undefined} />
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          <ThreadLikeButton threadId={thread.id} liked={!!thread.liked_by_me} count={thread.likes_count ?? 0} />
        </div>
      </article>

      <NewCommentForm threadId={thread.id} />

      <section className="space-y-4">
        <h2 className="font-semibold">Comentarios</h2>
        {comments.length === 0 && <div className="text-gray-500">Aún no hay comentarios.</div>}
  {comments.length > 0 && <CommentsTree threadId={thread.id} comments={comments} />}
      </section>
    </div>
  );
}

async function addComment(threadId: number, formData: FormData) {
  'use server';
  const body = String(formData.get('body') || '').trim();
  if (!body) return;
  const session = await getServerSession();
  if (!session.isAuthenticated) return;
  const link_url = String(formData.get('link_url') || '').trim();
  const attachments = [] as Array<{ kind: 'image' | 'link'; url: string; title?: string | null }>;
  if (link_url) attachments.push({ kind: 'link', url: link_url });
  await addForumComment(session.userId, threadId, body, null, attachments);
  revalidatePath(`/dashboard/foros/${threadId}`);
}

function NewCommentForm({ threadId }: { threadId: number }) {
  return (
    <form action={addComment.bind(null, threadId)} className="rounded border p-4 space-y-3 bg-white">
      <textarea name="body" placeholder="Escribe un comentario..." className="w-full border rounded p-2 min-h-[80px]" />
      <div className="grid grid-cols-1 gap-2">
        <input name="link_url" placeholder="Agregar link (opcional)" className="w-full border rounded p-2" />
      </div>
      <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Responder</button>
    </form>
  );
}

// ThreadLikeButton moved to a client component ../ThreadLikeButton
function Attachment({ kind, url, title }: { kind: 'image' | 'link'; url: string; title?: string }) {
  if (kind === 'image') {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={title || 'imagen'} className="max-h-64 rounded border" />
        {title && <div className="text-sm text-gray-600">{title}</div>}
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">
      {title || url}
    </a>
  );
}
