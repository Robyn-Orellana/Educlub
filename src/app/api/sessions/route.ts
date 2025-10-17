import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { getServerSession } from '../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CreateSessionBody = {
  course_code: string;
  counterparty_user_id: number; // tutor o estudiante según rol
  scheduled_at: string; // ISO 8601
  duration_min?: number; // default 60
  platform?: 'meet' | 'zoom' | 'webrtc';
  join_url?: string; // opcional, si se quiere forzar
  create_reservation?: boolean; // default true
  tutor_is_actor?: boolean; // legacy: si ambos son estudiantes, define quién actúa como tutor
  actor_is_host?: boolean; // nuevo esquema: define si el actor será el host (tutor/anfitrión)
};

function generateStubMeetLink() {
  // Genera un slug estilo meet: xxx-xxxx-xxx
  const part = (len: number) => Array.from({ length: len }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  return `https://meet.google.com/${part(3)}-${part(4)}-${part(3)}`;
}

export async function POST(req: NextRequest) {
  // Obtener sesión del actor
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }

  let body: CreateSessionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida' }, { status: 400 });
  }

  const course_code = (body.course_code || '').toString().trim();
  const counterparty_user_id = Number(body.counterparty_user_id);
  const scheduled_at = new Date(body.scheduled_at);
  const duration_min = typeof body.duration_min === 'number' ? body.duration_min : 60;
  const platform = (body.platform || 'meet') as 'meet' | 'zoom' | 'webrtc';
  const join_url = body.join_url ? String(body.join_url) : null;
  // Default: no reservation until invitee accepts (can override by sending true)
  const create_reservation = body.create_reservation === true; // default false
  const actor_is_host = typeof body.actor_is_host === 'boolean'
    ? body.actor_is_host
    : (body.tutor_is_actor !== false); // compat: si no viene actor_is_host, usamos tutor_is_actor (default true)

  if (!course_code) {
    return NextResponse.json({ ok: false, error: 'course_code requerido' }, { status: 400 });
  }
  if (!counterparty_user_id || Number.isNaN(counterparty_user_id)) {
    return NextResponse.json({ ok: false, error: 'counterparty_user_id inválido' }, { status: 400 });
  }
  if (isNaN(scheduled_at.getTime())) {
    return NextResponse.json({ ok: false, error: 'scheduled_at inválido' }, { status: 400 });
  }
  if (duration_min < 15 || duration_min > 240) {
    return NextResponse.json({ ok: false, error: 'duration_min fuera de rango (15..240)' }, { status: 400 });
  }
  if (!['meet','zoom','webrtc'].includes(platform)) {
    return NextResponse.json({ ok: false, error: 'platform inválida' }, { status: 400 });
  }

  try {
    // Verificar presencia de funciones para evitar errores ambiguos
    const check = await sql/* sql */`
      SELECT
        (to_regprocedure('public.app_schedule_session_v2(bigint, text, bigint, timestamp with time zone, integer, text, text, boolean, boolean)') IS NOT NULL) AS has_v2,
        (to_regprocedure('public.app_schedule_session(bigint, text, bigint, timestamp with time zone, integer, text, text, boolean, boolean)') IS NOT NULL) AS has_v1
    `;
    const has_v2 = Boolean(check?.[0]?.has_v2);
    const has_v1 = Boolean(check?.[0]?.has_v1);

    if (!has_v2 && !has_v1) {
      // Opción de fallback a stub si está permitido por env
      const allowStub = String(process.env.ALLOW_STUB_SCHEDULING || '').toLowerCase() === 'true' || String(process.env.ALLOW_STUB_SCHEDULING) === '1';
      if (allowStub) {
        const link = join_url || generateStubMeetLink();
        return NextResponse.json({
          ok: true,
          session: {
            session_id: 0,
            scheduled_at: scheduled_at.toISOString(),
            duration_min,
            platform,
            join_url: link,
            status: 'scheduled',
            host_id: actor_is_host ? session.userId : counterparty_user_id,
            guest_id: actor_is_host ? counterparty_user_id : session.userId,
          },
          reservation_id: null,
          warning: 'DB migration faltante: usando stub sin persistencia. Aplique sql/scheduling_functions.sql.'
        });
      }
      return NextResponse.json({ ok: false, error: 'DB migration requerida: crea public.app_schedule_session_v2 o actualiza public.app_schedule_session (9 parámetros). Aplica sql/scheduling_functions.sql.' }, { status: 500 });
    }

    // 1) Usar la función disponible
    let rows;
    if (has_v2) {
      rows = await sql/* sql */`
        SELECT * FROM public.app_schedule_session_v2(
          ${session.userId}::bigint,
          ${course_code}::text,
          ${counterparty_user_id}::bigint,
          ${scheduled_at.toISOString()}::timestamptz,
          ${duration_min}::int,
          ${platform}::text,
          ${join_url}::text,
          ${create_reservation}::boolean,
          ${actor_is_host}::boolean
        );
      `;
    } else {
      rows = await sql/* sql */`
        SELECT * FROM public.app_schedule_session(
          ${session.userId}::bigint,
          ${course_code}::text,
          ${counterparty_user_id}::bigint,
          ${scheduled_at.toISOString()}::timestamptz,
          ${duration_min}::int,
          ${platform}::text,
          ${join_url}::text,
          ${create_reservation}::boolean,
          ${actor_is_host}::boolean
        );
      `;
    }

  const r = rows?.[0] as { session_id?: number; reservation_id?: number | null; host_id?: number; guest_id?: number; tutor_id?: number; student_id?: number } | undefined;

    if (!r || !r.session_id) {
      return NextResponse.json({ ok: false, error: 'No se pudo crear la sesión' }, { status: 500 });
    }

    // 2) Consultar detalles para obtener join_url, etc.
    const details = await sql/* sql */`
      SELECT id AS session_id, scheduled_at, duration_min, platform, join_url, status
      FROM tutoring_sessions WHERE id = ${r.session_id};
    `;
  const d = details?.[0] as { session_id: number; scheduled_at: string; duration_min: number; platform: string; join_url: string | null; status: string } | undefined;
    // Adjuntar host/guest si vinieron en v2
  const sessionPayload: Record<string, unknown> = { ...(d ?? {}) };
  if (r?.host_id != null) (sessionPayload as Record<string, unknown>).host_id = r.host_id;
  if (r?.guest_id != null) (sessionPayload as Record<string, unknown>).guest_id = r.guest_id;
  if (r?.tutor_id != null) (sessionPayload as Record<string, unknown>).host_id = r.tutor_id; // compat
  if (r?.student_id != null) (sessionPayload as Record<string, unknown>).guest_id = r.student_id; // compat
  return NextResponse.json({ ok: true, session: sessionPayload, reservation_id: r?.reservation_id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/sessions POST error:', message);
    const allowStub = String(process.env.ALLOW_STUB_SCHEDULING || '').toLowerCase() === 'true' || String(process.env.ALLOW_STUB_SCHEDULING) === '1';
    if (allowStub) {
      const link = join_url || generateStubMeetLink();
      return NextResponse.json({
        ok: true,
        session: {
          session_id: 0,
          scheduled_at: scheduled_at.toISOString(),
          duration_min,
          platform,
          join_url: link,
          status: 'scheduled',
          host_id: actor_is_host ? session.userId : counterparty_user_id,
          guest_id: actor_is_host ? counterparty_user_id : session.userId,
        },
        reservation_id: null,
        warning: 'DB no disponible: usando stub sin persistencia. Aplique sql/scheduling_functions.sql y verifique conexión.'
      });
    }
    if (/record\s+"NEW"\s+has\s+no\s+field\s+"tutor_id"/i.test(message)) {
      return NextResponse.json({
        ok: false,
        error: 'Trigger de base de datos inválido: NEW.tutor_id no existe. Revisa los triggers sobre tutoring_sessions/reservations. Consulta sql/trigger_diagnostics.sql.',
        hint: 'Ejecuta sql/trigger_diagnostics.sql para listar triggers y su código, y deshabilita/ajusta el que usa NEW.tutor_id en una tabla que no lo tiene.'
      }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: message || 'Error interno' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  // Permitir valores por defecto cuando no se envían (rango: mes actual)
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(defaultFrom);
  defaultTo.setMonth(defaultTo.getMonth() + 1);
  const fromDate = fromParam ? new Date(fromParam) : defaultFrom;
  const toDate = toParam ? new Date(toParam) : defaultTo;
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return NextResponse.json({ ok: false, error: 'Fechas inválidas' }, { status: 400 });
  }
  try {
  type SessionRow = { session_id: number; scheduled_at: string; duration_min: number; platform: string; join_url: string | null; course_code: string; course_name: string; role: 'host' | 'guest' };
  const rows = await sql<SessionRow>/* sql */`
      WITH host AS (
        SELECT 
          s.id AS session_id,
          s.scheduled_at,
          s.duration_min,
          s.platform,
          s.join_url,
          c.code AS course_code,
          c.name AS course_name,
          'host'::text AS role
        FROM tutoring_sessions s
        JOIN courses c ON c.id = s.course_id
        WHERE s.tutor_id = ${session.userId}
          AND s.scheduled_at BETWEEN ${fromDate.toISOString()}::timestamptz AND ${toDate.toISOString()}::timestamptz
      ),
      guest AS (
        SELECT 
          s.id AS session_id,
          s.scheduled_at,
          s.duration_min,
          s.platform,
          s.join_url,
          c.code AS course_code,
          c.name AS course_name,
          'guest'::text AS role
        FROM tutoring_sessions s
        JOIN reservations r ON r.session_id = s.id AND r.student_id = ${session.userId} AND r.status <> 'canceled'
        JOIN courses c ON c.id = s.course_id
        WHERE s.scheduled_at BETWEEN ${fromDate.toISOString()}::timestamptz AND ${toDate.toISOString()}::timestamptz
      )
      SELECT * FROM host
      UNION ALL
      SELECT * FROM guest
      ORDER BY scheduled_at ASC;
    `;
    return NextResponse.json({ ok: true, sessions: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('/api/sessions GET error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
