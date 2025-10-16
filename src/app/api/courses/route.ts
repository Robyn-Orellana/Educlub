import { NextResponse } from 'next/server';
import { getAllCourses } from '../../../lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const courses = await getAllCourses();
    // Normalize shape just in case
    const data = courses.map((c: any) => ({ id: Number(c.id), code: String(c.code), name: String(c.name) }));
    return NextResponse.json({ ok: true, courses: data });
  } catch (err: any) {
    console.error('/api/courses error:', err?.message || err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
