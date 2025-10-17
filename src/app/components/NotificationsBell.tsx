"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type NotificationRow = {
  id: number;
  type: string;
  payload_json: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsBell() {
  const [unread, setUnread] = useState<number>(0);
  const [open, setOpen] = useState<boolean>(false);
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
      if (r.ok && d?.ok) {
        setUnread(d.unread || 0);
        setItems(d.notifications || []);
      }
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

  // Resolve partner names
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

  // Resolve join URLs for session_scheduled notifications
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

  // Fetch reservation statuses for session notifications
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
    try {
      await fetch(`/api/notifications/${id}/act`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    } catch {}
    await load();
    try { window.dispatchEvent(new CustomEvent('educlub:calendar:refresh')); } catch {}
  };

  const markRead = async (id: number) => {
    try { await fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) }); } catch {}
    await load();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="relative px-2 py-2 rounded-lg hover:bg-gray-100" aria-label="Notificaciones">
        <span className="text-xl">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">{unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <div className="text-sm font-medium">Notificaciones</div>
            <Link href="/dashboard/notificaciones" className="text-xs text-violet-600 hover:underline">Ver todas</Link>
          </div>
          <div className="p-2">
            {loading && <div className="text-xs text-gray-500 px-2 py-2">Cargando…</div>}
            {!loading && items.length === 0 && (
              <div className="text-xs text-gray-500 px-2 py-2">No hay notificaciones</div>
            )}
            {!loading && items.map((n) => {
              const p = (n.payload_json ?? {}) as Record<string, unknown>;
              const when = new Date(n.created_at);
              const title = n.type === 'session_scheduled'
                ? `Sesión ${(p.course_name as string) || (p.course_code as string) || ''} el ${new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date((p.scheduled_at as string) || n.created_at))}`
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
              const isInvitee = n.type === 'session_scheduled' && Boolean(meId) && (
                Number(p.guest_id as number | string | undefined) === meId || (p.guest_id == null)
              );
              const currentStatus = Number.isFinite(sessionId) ? statuses[sessionId as number] : undefined;
              const hasDecision = Boolean(currentStatus);
              const statusLabel = currentStatus ? (currentStatus === 'canceled' ? 'Rechazada' : 'Aceptada') : null;
              let showActions = false;
              if (statusesLoaded && actionable && isInvitee && !n.read_at) {
                if (!hasDecision) showActions = true;
                else if (currentStatus === 'reserved') showActions = true;
              }
              return (
                <div key={n.id} className={`p-2 rounded-md ${n.read_at ? 'bg-white' : 'bg-violet-50'}`}>
                  <div className="text-xs text-gray-700 mb-1 line-clamp-2">{title}{partnerLabel}</div>
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-gray-500">{when.toLocaleString('es-ES')}</div>
                    <div className="flex items-center gap-1">
                      {Number.isFinite(sessionId) && joinUrls[sessionId as number] && (
                        <a href={joinUrls[sessionId as number]} target="_blank" rel="noopener noreferrer" className="text-[11px] px-2 py-1 rounded-md bg-violet-600 text-white hover:bg-violet-700">Unirse</a>
                      )}
                      {statusLabel && (
                        <span className={`px-2 py-0.5 text-[10px] rounded-full ${statusLabel === 'Rechazada' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{statusLabel}</span>
                      )}
                      {showActions && (
                        <>
                          {!hasDecision && (
                            <button onClick={() => act(n.id, 'accept')} className="text-[11px] px-2 py-1 rounded-md bg-green-600 text-white hover:bg-green-700">Aceptar</button>
                          )}
                          <button onClick={() => act(n.id, 'deny')} className="text-[11px] px-2 py-1 rounded-md bg-red-600 text-white hover:bg-red-700">{hasDecision ? 'Cancelar' : 'Rechazar'}</button>
                        </>
                      )}
                      {!n.read_at && (
                        <button onClick={() => markRead(n.id)} className="text-[11px] px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-100">Marcar leída</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
