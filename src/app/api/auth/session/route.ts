import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/session';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const s = await getServerSession();
    return NextResponse.json(s);
  } catch (e) {
    console.error('Error en /api/auth/session:', e instanceof Error ? e.message : e);
    return NextResponse.json({ isAuthenticated: false }, { status: 200 });
  }
}
