import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/session';
import { getPresignedPutUrl } from '../../../../lib/storage';
import type { PresignResourceRequest } from '../../../../lib/types/resources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  try {
  const body = (await req.json()) as Partial<PresignResourceRequest> | null;
  const { semester, courseId, courseCode, fileName, contentType } = body ?? {};
    if (!semester || !/^\d{4}-[12]$/.test(String(semester))) {
      return NextResponse.json({ ok: false, error: 'Semestre inválido (formato esperado YYYY-1|YYYY-2)' }, { status: 400 });
    }
    const cid = Number(courseId);
    if (!Number.isFinite(cid) || cid <= 0) {
      return NextResponse.json({ ok: false, error: 'courseId inválido' }, { status: 400 });
    }
    if (!courseCode || typeof courseCode !== 'string') {
      return NextResponse.json({ ok: false, error: 'courseCode requerido' }, { status: 400 });
    }
    if (!contentType || typeof contentType !== 'string') {
      return NextResponse.json({ ok: false, error: 'contentType requerido' }, { status: 400 });
    }
    const safeName = String(fileName || 'file').replace(/[^A-Za-z0-9._-]/g, '_');
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return NextResponse.json({ ok: false, error: 'S3_BUCKET no configurado' }, { status: 500 });
    const keyBase = `resources/${semester}/${courseCode}/${session.userId}`;
    const key = `${keyBase}/${crypto.randomUUID()}-${safeName}`;
    const { url, publicUrl } = await getPresignedPutUrl({ bucket, key, contentType, expiresInSec: 600 });
    return NextResponse.json({ ok: true, url, key, publicUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
