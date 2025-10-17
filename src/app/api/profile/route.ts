import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/session';
import { getUserProfile, updateUserProfile } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const profile = await getUserProfile(session.userId);
  return NextResponse.json({ ok: true, profile });
}

type PatchBody = {
  first_name?: unknown;
  last_name?: unknown;
  role?: unknown;
  avatar_url?: unknown;
};

export async function PATCH(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida' }, { status: 400 });
  }

  const first_name = typeof body.first_name === 'string' ? body.first_name.trim() : undefined;
  const last_name = typeof body.last_name === 'string' ? body.last_name.trim() : undefined;
  const role = body.role === 'student' || body.role === 'tutor' ? (body.role as 'student' | 'tutor') : undefined;
  const avatar_url = body.avatar_url === null || typeof body.avatar_url === 'string' ? (body.avatar_url as string | null) : undefined;

  const updated = await updateUserProfile(session.userId, { first_name, last_name, role, avatar_url });
  if (!updated) {
    return NextResponse.json({ ok: false, error: 'No se pudo actualizar' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, profile: updated });
}
