// lib/session.ts
import { cookies } from 'next/headers';
import { sql } from './db';

export type ServerSession = {
  token: string;            // UUID de la sesión (s.id)
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  expires_at?: string;
  isAuthenticated: boolean;
};

const defaultSession: ServerSession = {
  token: '',
  userId: 0,
  userName: '',
  userEmail: '',
  userRole: '',
  isAuthenticated: false,
};

// Valida UUID v1..v5 (RFC4122)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getServerSession(): Promise<ServerSession> {
  try {
    // Leer cookie de sesión
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('sid')?.value;

    // Si no hay cookie o no es un UUID, no consultes la DB
    if (!sessionToken || !UUID_RE.test(sessionToken)) {
      return defaultSession;
    }

    // Validar sesión contra auth_sessions y obtener datos del usuario
    const rows = await sql<{
      user_id: number;
      first_name: string;
      last_name: string;
      email: string;
      role: string;
      expires_at: string;
    }>`
      SELECT s.user_id,
             u.first_name,
             u.last_name,
             u.email,
             r.name AS role,
             s.expires_at
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN roles r ON r.id = u.role_id
      WHERE s.id = ${sessionToken}::uuid
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      LIMIT 1;
    `;

    const row = rows?.[0];
    if (!row) return defaultSession;

    return {
      token: sessionToken,
      userId: row.user_id,
      userName: `${row.first_name} ${row.last_name}`.trim(),
      userEmail: row.email,
      userRole: row.role,
      expires_at: row.expires_at,
      isAuthenticated: true,
    };
  } catch (err) {
    console.error('Error al obtener la sesión:', err);
    return defaultSession;
  }
}
