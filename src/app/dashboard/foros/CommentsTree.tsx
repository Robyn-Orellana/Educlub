"use client";
import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Comment as ForumComment } from '../../../lib/types/forums';
import { useEffect } from 'react';

type Props = {
  threadId: number;
  comments: (ForumComment & { likes_count?: number; liked_by_me?: boolean })[];
};

type Node = ForumComment & {
  children: Node[];
  likes_count?: number;
  liked_by_me?: boolean;
  attachments?: Array<{ id: number; kind: 'image' | 'link'; url: string; title?: string | null }>;
};

export default function CommentsTree({ threadId, comments }: Props) {
  const tree = useMemo(() => buildTree(comments), [comments]);
  return (
    <div className="space-y-4">
      {tree.map((node) => (
        <CommentNode key={node.id} node={node} threadId={threadId} depth={0} />
      ))}
    </div>
  );
}

function buildTree(comments: ForumComment[]): Node[] {
  const byId = new Map<number, Node>();
  const roots: Node[] = [];
  for (const c of comments) {
    byId.set(c.id, { ...c, children: [] });
  }
  for (const c of comments) {
    const node = byId.get(c.id)!;
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function CommentNode({ node, threadId, depth }: { node: Node; threadId: number; depth: number }) {
  const [showReply, setShowReply] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // No-op: se eliminó la obtención de "me" para evitar variables sin uso.
  }, []);
  return (
    <div className="space-y-2" style={{ marginLeft: depth * 16 }}>
      <div className="rounded border p-3 bg-white">
        <div className="text-sm text-gray-600 mb-2">{node.author_name} • {new Date(node.created_at).toLocaleString()}</div>
        <LongText text={node.body} expanded={expanded} onToggle={() => setExpanded((s) => !s)} />
        {node.attachments && node.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {node.attachments.map((a: { id: number; kind: 'image' | 'link'; url: string; title?: string | null }) => (
              <Attachment key={a.id} kind={a.kind} url={a.url} title={a.title || undefined} />
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center gap-3">
          <LikeButton kind="comment" id={node.id} liked={!!node.liked_by_me} count={node.likes_count ?? 0} onDone={() => router.refresh()} />
          <button className="text-sm text-blue-600 hover:underline" onClick={() => setShowReply((s) => !s)}>
            {showReply ? 'Cancelar' : 'Responder'}
          </button>
          {/* Eliminar: idealmente la API nos diría si soy autor. Como aproximación, mostramos siempre y la API valida. */}
          <DeleteButton commentId={node.id} onDone={() => router.refresh()} />
        </div>
        {showReply && (
          <div className="mt-2">
            <InlineReplyForm threadId={threadId} parentId={node.id} onDone={() => setShowReply(false)} />
          </div>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="space-y-2">
          {node.children.map((child: Node) => (
            <CommentNode key={child.id} node={child} threadId={threadId} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function LongText({ text, expanded, onToggle }: { text: string; expanded: boolean; onToggle: () => void }) {
  const limit = 280;
  const isLong = text.length > limit;
  const content = expanded || !isLong ? text : text.slice(0, limit) + '…';
  return (
    <div>
      <div className="whitespace-pre-wrap">{content}</div>
      {isLong && (
        <button className="mt-2 text-sm text-gray-600 hover:underline" onClick={onToggle}>
          {expanded ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  );
}

function LikeButton({ kind, id, liked, count, onDone }: { kind: 'thread' | 'comment'; id: number; liked: boolean; count: number; onDone?: () => void }) {
  const [loading, setLoading] = useState(false);
  async function toggle() {
    setLoading(true);
    try {
      const url = kind === 'thread' ? `/api/forums/${id}/like` : `/api/forums/comments/${id}/like`;
      await fetch(url, { method: 'POST' });
      onDone?.();
    } finally {
      setLoading(false);
    }
  }
  return (
    <button disabled={loading} onClick={toggle} className="text-sm flex items-center gap-1">
      <span className={liked ? 'text-red-600' : 'text-gray-600'}>❤</span>
      <span>{count}</span>
    </button>
  );
}

function DeleteButton({ commentId, onDone }: { commentId: number; onDone?: () => void }) {
  const [loading, setLoading] = useState(false);
  async function del() {
    if (!confirm('¿Eliminar este comentario?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/forums/comments/${commentId}`, { method: 'DELETE' });
      if (!res.ok) {
        // opcional mostrar error
      }
      onDone?.();
    } finally {
      setLoading(false);
    }
  }
  return (
    <button disabled={loading} onClick={del} className="text-sm text-red-600 hover:underline">Eliminar</button>
  );
}

function InlineReplyForm({ threadId, parentId, onDone }: { threadId: number; parentId: number; onDone?: () => void }) {
  const [value, setValue] = useState('');
  const [link, setLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = value.trim();
    if (!body) return;
    setSubmitting(true);
    try {
  const attachments: Array<{ kind: 'link'; url: string }> = [];
      if (link.trim()) attachments.push({ kind: 'link', url: link.trim() });
  // eliminar soporte de imagen subida real; mantenemos solo links
      const res = await fetch(`/api/forums/${threadId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, parent_id: parentId, attachments })
      });
      if (!res.ok) {
        // opcional: mostrar error
      }
    setValue('');
    setLink('');
      onDone?.();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        className="w-full border rounded p-2 min-h-[60px]"
        placeholder="Escribe una respuesta..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="grid grid-cols-1 md:grid-cols-1 gap-2">
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Agregar link (opcional)" className="w-full border rounded p-2" />
      </div>
      {/* Se quitó el uploader de imágenes reales */}
      <div className="flex gap-2">
        <button disabled={submitting} type="submit" className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          Responder
        </button>
        <button type="button" className="px-3 py-1.5 rounded border" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  );
}

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
