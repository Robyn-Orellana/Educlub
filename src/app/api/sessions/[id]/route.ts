import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../../lib/db';
import { getServerSession } from '../../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const session = await getServerSession();
	if (!session.isAuthenticated) {
		return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
	}
	const { id } = await ctx.params;
	const sid = Number(id);
	if (!Number.isFinite(sid)) {
		return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 });
	}
	try {
		const rows = await sql/* sql */`
			SELECT 
				s.id AS session_id,
				s.scheduled_at,
				s.duration_min,
				s.platform,
				COALESCE(s.meet_link, s.join_url) AS join_url,
				s.room_name,
				s.meet_link,
				s.status
			FROM tutoring_sessions s
			WHERE s.id = ${sid}
			LIMIT 1;
		`;
		const r = rows?.[0];
		if (!r) return NextResponse.json({ ok: false, error: 'No encontrada' }, { status: 404 });
		// Basic access: user must be tutor or a reserving student
		const tutorRows = await sql<{ tutor_id: number }>`SELECT tutor_id FROM tutoring_sessions WHERE id = ${sid} LIMIT 1;`;
		const tutorId = tutorRows?.[0]?.tutor_id;
		if (tutorId !== session.userId) {
			const can = await sql/* sql */`
				SELECT 1 FROM reservations WHERE session_id = ${sid} AND student_id = ${session.userId} AND status <> 'canceled' LIMIT 1;
			`;
			if (can.length === 0) return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 403 });
		}
		return NextResponse.json({ ok: true, session: r });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error('/api/sessions/[id] GET error:', msg);
		return NextResponse.json({ ok: false, error: msg }, { status: 500 });
	}
}
