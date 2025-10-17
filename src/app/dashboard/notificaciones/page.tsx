"use client";
import React, { useEffect, useState } from 'react';

type NotificationRow = {
  id: number;
  type: string;
  payload_json: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [meId, setMeId] = useState<number | null>(null);
  const [userMap, setUserMap] = useState<Record<number, { name: string; email: string }>>({});
  const [statuses, setStatuses] = useState<Record<number, 'reserved' | 'attended' | 'no_show' | 'canceled'>>({});
  const [statusesLoaded, setStatusesLoaded] = useState<boolean>(false);
  const [joinUrls, setJoinUrls] = useState<Record<number, string>>({}); // session_id -> join_url

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/notifications');
      const d = await r.json();
      if (r.ok && d?.ok) setItems(d.notifications || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/auth/session');
        const d = await r.json();
        if (r.ok && d?.isAuthenticated) setMeId(Number(d.userId));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const ids = Array.from(new Set(items.map((n) => {
        const p = (n.payload_json ?? {}) as Record<string, unknown>;
        const hostId = Number(p.host_id as number | string | undefined);
        const guestId = Number(p.guest_id as number | string | undefined);
        return [hostId, guestId];
      }).flat().filter((n): n is number => Number.isFinite(n))));
      if (ids.length === 0) return;
      try {
        const r = await fetch(`/api/users/lookup?ids=${encodeURIComponent(ids.join(','))}`);
        const d = await r.json();
        if (r.ok && d?.ok) {
          const m: Record<number, { name: string; email: string }> = {};
          for (const u of d.users as Array<{ id: number; name: string; email: string }>) m[u.id] = { name: u.name, email: u.email };
          setUserMap(m);
        }
      } catch {}
    })();
  }, [items]);

  // Resolve join URLs for listed notifications
  useEffect(() => {
    (async () => {
      const ids = Array.from(new Set(items.map((n) => Number((n.payload_json ?? {})['session_id'] as any)).filter((n): n is number => Number.isFinite(n))));
      if (ids.length === 0) { setJoinUrls({}); return; }
      const map: Record<number, string> = {};
      for (const id of ids) {
        try {
          const r = await fetch(`/api/sessions/${id}`);
          const d = await r.json();
          if (r.ok && d?.ok && d.session?.join_url) map[id] = d.session.join_url as string;
        } catch {}
      }
      setJoinUrls(map);
    })();
  }, [items]);

  // Fetch reservation statuses for listed notifications' sessions
  useEffect(() => {
    (async () => {
      setStatusesLoaded(false);
      const sessionIds = Array.from(new Set(items.map((n) => {
        const p = (n.payload_json ?? {}) as Record<string, unknown>;
        const sid = Number(p.session_id as number | string | undefined);
        return sid;
      }).filter((n): n is number => Number.isFinite(n))));
      if (sessionIds.length === 0) { setStatuses({}); setStatusesLoaded(true); return; }
      try {
        const r = await fetch(`/api/reservations/status?session_ids=${encodeURIComponent(sessionIds.join(','))}`);
        const d = await r.json();
        if (r.ok && d?.ok) setStatuses(d.reservations || {});
      } catch {
        setStatuses({});
      } finally {
        setStatusesLoaded(true);
      }
    })();
  }, [items]);

  const act = async (id: number, action: 'accept'|'deny') => {
    try { await fetch(`/api/notifications/${id}/act`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); } catch {}
    await load();
    try { window.dispatchEvent(new CustomEvent('educlub:calendar:refresh')); } catch {}
  };
  const markRead = async (id: number, read: boolean) => {
    try { await fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read }) }); } catch {}
    await load();
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold mb-4">Notificaciones</h1>
      {loading && <div className="text-sm text-gray-500">Cargando…</div>}
      {!loading && items.length === 0 && <div className="text-sm text-gray-500">No hay notificaciones.</div>}
      <div className="flex flex-col gap-3">
        {items.map(n => {
          const p = (n.payload_json ?? {}) as Record<string, unknown>;
          const when = new Date(n.created_at);
          const title = n.type === 'session_scheduled'
            ? `Sesión ${(p.course_name as string) || (p.course_code as string) || ''} — ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date((p.scheduled_at as string) || n.created_at))}`
            : n.type;
          const sessionId = Number(p.session_id as number | string | undefined);
          const actionable = n.type === 'session_scheduled' && Number.isFinite(sessionId) && Boolean(meId);
          const partnerId = (() => {
            const hostId = Number(p.host_id as number | string | undefined);
            const guestId = Number(p.guest_id as number | string | undefined);
            if (meId && hostId && meId !== hostId) return hostId;
            if (meId && guestId && meId !== guestId) return guestId;
            return null;
          })();
          const partnerLabel = partnerId && userMap[partnerId] ? ` · con ${userMap[partnerId].name}` : partnerId ? ` · con usuario #${partnerId}` : '';
          // Fallback: estas notificaciones solo se envían al invitado, así que si falta guest_id, asumimos que el usuario actual es el invitado
          const isInvitee = n.type === 'session_scheduled' && Boolean(meId) && (
            Number(p.guest_id as number | string | undefined) === meId || (p.guest_id == null)
          );
          const currentStatus = Number.isFinite(sessionId) ? statuses[sessionId as number] : undefined;
          const hasDecision = Boolean(currentStatus);
          const statusLabel = currentStatus ? (currentStatus === 'canceled' ? 'Rechazada' : 'Aceptada') : null;
          // Evitar parpadeo: no mostrar acciones hasta cargar estados
          let showActions = false;
          if (statusesLoaded && actionable && isInvitee && !n.read_at) {
            if (!hasDecision) {
              showActions = true; // pendiente: Aceptar/Rechazar
            } else if (currentStatus === 'reserved') {
              showActions = true; // ya aceptada: permitir Rechazar para cancelar
            }
          }
          return (
            <div key={n.id} className={`p-3 rounded-lg border ${n.read_at ? 'bg-white border-gray-200' : 'bg-violet-50 border-violet-200'}`}>
              <div className="text-sm text-gray-800">{title}{partnerLabel}</div>
              <div className="text-xs text-gray-500 mb-2">{when.toLocaleString('es-ES')}</div>
              <div className="flex items-center gap-2">
                {Number.isFinite(sessionId) && joinUrls[sessionId as number] && (
                  <a href={joinUrls[sessionId as number]} target="_blank" rel="noopener noreferrer" className="px-2 py-1.5 text-xs rounded-md bg-violet-600 text-white hover:bg-violet-700">Unirse</a>
                )}
                {statusLabel && (
                  <span className={`px-2 py-0.5 text-[11px] rounded-full ${statusLabel === 'Rechazada' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{statusLabel}</span>
                )}
                {showActions && (
                  <>
                    {!hasDecision && (
                      <button onClick={() => act(n.id, 'accept')} className="px-3 py-1.5 text-xs rounded-md bg-green-600 text-white hover:bg-green-700">Aceptar</button>
                    )}
                    <button onClick={() => act(n.id, 'deny')} className="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700">{hasDecision ? 'Cancelar' : 'Rechazar'}</button>
                  </>
                )}
                {!n.read_at ? (
                  <button onClick={() => markRead(n.id, true)} className="px-3 py-1.5 text-xs rounded-md border border-gray-200 hover:bg-gray-100">Marcar leída</button>
                ) : (
                  <button onClick={() => markRead(n.id, false)} className="px-3 py-1.5 text-xs rounded-md border border-gray-200 hover:bg-gray-100">Marcar como no leída</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
