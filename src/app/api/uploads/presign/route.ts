import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/session';
import { getPresignedPutUrl } from '../../../../lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session.isAuthenticated) {
    return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 });
  }
  try {
    const json = await req.json();
    const contentType = typeof json?.contentType === 'string' ? json.contentType : '';
    const fileName = typeof json?.fileName === 'string' ? json.fileName : 'file';
    if (!contentType || !contentType.startsWith('image/')) {
      return NextResponse.json({ ok: false, error: 'Tipo de archivo no permitido' }, { status: 400 });
    }
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return NextResponse.json({ ok: false, error: 'S3_BUCKET no configurado' }, { status: 500 });
    const keyBase = `forums/${session.userId}/${new Date().toISOString().slice(0,7)}`; // yyyy-mm
    const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '_');
    const key = `${keyBase}/${crypto.randomUUID()}-${safeName}`;
    const { url, publicUrl } = await getPresignedPutUrl({ bucket, key, contentType, expiresInSec: 600 });
    return NextResponse.json({ ok: true, url, publicUrl, key, contentType });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
