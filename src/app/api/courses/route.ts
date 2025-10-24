import { NextResponse } from 'next/server';
import { getAllCourses } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const courses = await getAllCourses();
    // Normalize shape just in case
    const data = (courses as Array<{ id: number | string; code: string; name: string }>).map((c) => ({
      id: Number(c.id),
      code: String(c.code),
      name: String(c.name),
    }));
    return NextResponse.json({ ok: true, courses: data }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/api/courses error:', message);
    return NextResponse.json({ ok: false, error: 'Error interno' }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }
}
