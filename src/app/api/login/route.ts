import { NextRequest, NextResponse } from 'next/server';
import { sql } from '../../../lib/db';

export const runtime = 'nodejs';

type LoginRow = {
  token: string; // uuid
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  expires_at: string;
};

type LoginBody = {
  email?: string;
  password?: string;
  remember?: boolean;
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
  const ua = req.headers.get('user-agent') || 'unknown';

  let body: LoginBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Solicitud inválida' }, { status: 400 });
  }

  const email = (body.email ?? '').toString().trim();
  const password = (body.password ?? '').toString();
  const remember = Boolean(body.remember);

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: 'Email y contraseña requeridos' }, { status: 400 });
  }

  const ttl = (remember ? 60 * 24 * 7 : 60 * 24 * 3); // minutos

  try {
    const rows = await sql/* sql */`
      SELECT * FROM app_login(${email}, ${password}, ${ip}::inet, ${ua}, ${ttl});
    `;

    const typed = rows as unknown as LoginRow[];
    if (!typed || typed.length === 0) {
      return NextResponse.json({ ok: false, error: 'Credenciales inválidas' }, { status: 401 });
    }

    const s = typed[0];

    // Set cookie sid con atributos seguros
    const res = NextResponse.json({
      ok: true,
      user: {
        id: s.user_id,
        email: s.email,
        first_name: s.first_name,
        last_name: s.last_name,
        role: s.role,
      },
      expires_at: s.expires_at,
    });

    // calcular maxAge en segundos a partir de expires_at
    const exp = new Date(s.expires_at).getTime();
    const maxAge = Math.max(0, Math.floor((exp - Date.now()) / 1000));

    res.cookies.set('sid', s.token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge,
      path: '/',
    });

    return res;
  } catch (err) {
    // No exponer detalles sensibles
    console.error('Error en /api/login:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Error interno' }, { status: 500 });
  }
}
