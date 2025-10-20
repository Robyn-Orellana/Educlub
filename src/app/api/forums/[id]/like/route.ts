import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/session';
import { toggleThreadLike } from '../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = Promise<{ id: string }>;

export async function POST(_req: NextRequest, ctx: { params: Params }) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const threadId = Number(id);
  if (!Number.isFinite(threadId)) return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 });
  const res = await toggleThreadLike(session.userId, threadId);
  return NextResponse.json({ ok: true, ...res });
}
