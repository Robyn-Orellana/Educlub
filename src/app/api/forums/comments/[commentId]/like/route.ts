import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../../lib/session';
import { toggleCommentLike } from '../../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = Promise<{ commentId: string }>;

export async function POST(_req: NextRequest, ctx: { params: Params }) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  const { commentId } = await ctx.params;
  const idNum = Number(commentId);
  if (!Number.isFinite(idNum)) return NextResponse.json({ ok: false, error: 'ID inválido' }, { status: 400 });
  const res = await toggleCommentLike(session.userId, idNum);
  return NextResponse.json({ ok: true, ...res });
}
