import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';
import { getServerSession } from '../../../lib/session';
import { createJitsiRoomName, jitsiLink } from '../../../lib/jitsi';

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
      // Fallback con persistencia directa y Jitsi real
      const courseRows = await sql<{ id: number; name: string }>`SELECT id, name FROM courses WHERE code = ${course_code} LIMIT 1;`;
      const course = courseRows?.[0];
      if (!course) return NextResponse.json({ ok: false, error: `Curso ${course_code} no existe` }, { status: 400 });
      const room = createJitsiRoomName('tutor');
      const link = jitsiLink(room);
      const host_id = actor_is_host ? session.userId : counterparty_user_id;
      const guest_id = actor_is_host ? counterparty_user_id : session.userId;
      const inserted = await sql<{ id: number }>`
        INSERT INTO tutoring_sessions(
          course_id, tutor_id, scheduled_at, duration_min, platform,
          join_url, room_name, meet_link, status, starts_at, ends_at
        ) VALUES (
          ${course.id}, ${host_id}, ${scheduled_at.toISOString()}::timestamptz, ${duration_min}, ${platform},
          ${link}, ${room}, ${link}, 'scheduled', ${scheduled_at.toISOString()}::timestamptz,
          (${scheduled_at.toISOString()}::timestamptz + make_interval(mins => ${duration_min}))
        ) RETURNING id;
      `;
      const sid = inserted?.[0]?.id;
      if (!sid) return NextResponse.json({ ok: false, error: 'No se pudo crear la sesión (fallback)' }, { status: 500 });
      if (body.create_reservation) {
        await sql/* sql */`
          INSERT INTO reservations(session_id, student_id, status)
          VALUES (${sid}, ${guest_id}, 'reserved')
          ON CONFLICT (session_id, student_id) DO UPDATE SET status = EXCLUDED.status;
        `;
      }
      // Notificar al invitado
      await sql/* sql */`
        INSERT INTO notifications(user_id, type, payload_json)
        VALUES (
          ${guest_id}, 'session_scheduled',
          jsonb_build_object(
            'session_id', ${sid},
            'course_code', ${course_code},
            'course_name', ${course.name},
            'scheduled_at', ${scheduled_at.toISOString()}::timestamptz,
            'platform', ${platform},
            'host_id', ${host_id},
            'guest_id', ${guest_id}
          )
        );
      `;
      return NextResponse.json({
        ok: true,
        session: {
          session_id: sid,
          scheduled_at: scheduled_at.toISOString(),
          duration_min,
          platform,
          join_url: link,
          status: 'scheduled',
          host_id,
          guest_id,
        },
        reservation_id: body.create_reservation ? 1 : null
      });
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

    // 2) Consultar detalles y asegurar Jitsi join_url si falta
    let details = await sql/* sql */`
      SELECT id AS session_id, scheduled_at, duration_min, platform, join_url, status, room_name, meet_link
      FROM tutoring_sessions WHERE id = ${r.session_id};
    `;
    let d = details?.[0] as { session_id: number; scheduled_at: string; duration_min: number; platform: string; join_url: string | null; status: string; room_name?: string | null; meet_link?: string | null } | undefined;

    const isPlaceholder = d && d.join_url && /https?:\/\/meet\.example\//i.test(d.join_url);
    if (d && (!d.join_url || !d.join_url.trim() || isPlaceholder)) {
      // Idempotente: si no hay join_url, generamos uno Jitsi y lo persistimos
      const room = d.room_name && d.room_name.trim().length > 0 ? d.room_name : createJitsiRoomName('tutor');
      const link = d.meet_link && d.meet_link.trim().length > 0 ? d.meet_link : jitsiLink(room);
      await sql/* sql */`
        UPDATE tutoring_sessions
        SET room_name = ${room},
            meet_link = ${link},
            join_url  = ${link},
            starts_at = COALESCE(starts_at, scheduled_at),
            ends_at   = COALESCE(ends_at, scheduled_at + make_interval(mins => duration_min))
        WHERE id = ${r.session_id};
      `;
      details = await sql/* sql */`
        SELECT id AS session_id, scheduled_at, duration_min, platform, join_url, status, room_name, meet_link
        FROM tutoring_sessions WHERE id = ${r.session_id};
      `;
      d = details?.[0] as any;
    }
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
    type SessionRow = { session_id: number; scheduled_at: string; duration_min: number; platform: string; join_url: string | null; room_name: string | null; meet_link: string | null; course_code: string; course_name: string; role: 'host' | 'guest'; partner_id: number | null; partner_name: string | null };
    const rows = await sql<SessionRow>/* sql */`
      WITH host AS (
        SELECT 
          s.id AS session_id,
          s.scheduled_at,
          s.duration_min,
          s.platform,
          COALESCE(s.meet_link, s.join_url) AS join_url,
          s.room_name,
          s.meet_link,
          c.code AS course_code,
          c.name AS course_name,
          'host'::text AS role,
          -- partner: primer estudiante reservado
          r1.student_id AS partner_id,
          u1.first_name || ' ' || u1.last_name AS partner_name
        FROM tutoring_sessions s
        JOIN courses c ON c.id = s.course_id
        LEFT JOIN LATERAL (
          SELECT r.student_id FROM reservations r
          WHERE r.session_id = s.id AND r.status <> 'canceled'
          ORDER BY CASE WHEN r.status = 'reserved' THEN 0 ELSE 1 END, r.id
          LIMIT 1
        ) r1 ON TRUE
        LEFT JOIN users u1 ON u1.id = r1.student_id
        WHERE s.tutor_id = ${session.userId}
          AND s.scheduled_at BETWEEN ${fromDate.toISOString()}::timestamptz AND ${toDate.toISOString()}::timestamptz
      ),
      guest AS (
        SELECT 
          s.id AS session_id,
          s.scheduled_at,
          s.duration_min,
          s.platform,
          COALESCE(s.meet_link, s.join_url) AS join_url,
          s.room_name,
          s.meet_link,
          c.code AS course_code,
          c.name AS course_name,
          'guest'::text AS role,
          s.tutor_id AS partner_id,
          u2.first_name || ' ' || u2.last_name AS partner_name
        FROM tutoring_sessions s
        JOIN reservations r ON r.session_id = s.id AND r.student_id = ${session.userId} AND r.status <> 'canceled'
        JOIN courses c ON c.id = s.course_id
        LEFT JOIN users u2 ON u2.id = s.tutor_id
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
