# Implementación de Autenticación en EduClub

Este documento explica la implementación de autenticación en el proyecto EduClub utilizando PostgreSQL + Neon para sesiones seguras.

## Sistema de Autenticación

Se ha implementado un sistema de autenticación personalizado basado en cookies HTTP seguras y tokens de sesión almacenados en la base de datos PostgreSQL.

### Componentes Principales

1. **Autenticación de usuarios**
   - `/src/app/api/login/route.ts`: Maneja el proceso de login y establece cookies seguras
   - `/src/app/api/logout/route.ts`: Gestiona el cierre de sesión y elimina cookies
   - `/src/app/api/auth/session/route.ts`: API para verificar estado de sesión actual

2. **Gestión de sesiones**
   - `/src/lib/db.ts`: Conexión a Neon DB y funciones de autenticación
   - `/src/lib/session.ts`: Proporciona funcionalidad para obtener información de sesión del lado del servidor
   - `/src/lib/edge-utils.ts`: Utilidades compatibles con Edge Runtime

3. **Protección de rutas**
   - `/src/middleware.ts`: Middleware liviano que protege rutas específicas verificando cookies

4. **Componentes de UI**
   - `/src/app/login/page.tsx`: Página de login dedicada
   - `/src/app/components/LogoutButton.tsx`: Componente para cerrar sesión
   - `/src/app/dashboard/layout.tsx`: Layout con botón de logout integrado

### Estructura de Base de Datos

**Tabla auth_sessions**
```sql
CREATE TABLE IF NOT EXISTS auth_sessions (
  id bigserial PRIMARY KEY,
  token text NOT NULL UNIQUE,
  user_id bigint NOT NULL REFERENCES users(id),
  ip_address text NOT NULL,
  user_agent text NOT NULL,
  valid_until timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT FALSE,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_valid_until ON auth_sessions(valid_until);
```

**Funciones SQL**

```sql
-- app_login: Autentica usuario y crea sesión
CREATE OR REPLACE FUNCTION app_login(
  p_email text,
  p_password text,
  p_ip inet,
  p_ua text,
  p_ttl int DEFAULT 1440 -- 24 horas por defecto
) RETURNS TABLE (...) AS $$ ... $$;

-- app_logout: Revoca una sesión activa
CREATE OR REPLACE FUNCTION app_logout(
  p_token text
) RETURNS boolean AS $$ ... $$;

-- app_validate_session: Valida un token de sesión
CREATE OR REPLACE FUNCTION app_validate_session(
  p_token text
) RETURNS TABLE (...) AS $$ ... $$;
```

## Flujo de Autenticación

1. **Login**
   - Usuario introduce credenciales en la página de login
   - La aplicación envía una solicitud a `/api/login` con email, password y opción "remember"
   - El servidor llama a la función SQL `app_login()`
   - Se crea un registro en `auth_sessions` con token único, IP, user-agent y tiempo de expiración
   - Se establece una cookie HTTP segura (`sid`) con el token de sesión
   - El usuario es redirigido al dashboard

2. **Validación en Rutas Protegidas**
   - El middleware intercepta solicitudes a rutas `/dashboard/*`
   - Se verifica la existencia de la cookie `sid`
   - Si la cookie no existe, se redirige a `/login`

3. **Validación del Lado del Servidor**
   - `getServerSession()` consulta la base de datos para verificar que el token es válido
   - Se comprueba que el token exista, no esté revocado y no haya expirado
   - Retorna información del usuario si la sesión es válida

4. **Logout**
   - Usuario hace clic en "Cerrar sesión"
   - Se envía solicitud a `/api/logout`
   - El servidor marca la sesión como revocada en la base de datos
   - Se elimina la cookie `sid` del navegador
   - El usuario es redirigido a la página principal

## Seguridad

- **Cookies**: HTTP-Only, Secure (en producción), SameSite=lax
- **Tokens**: Generados aleatoriamente con alta entropía (función pgcrypto)
- **Contraseñas**: Hasheadas usando bcrypt (vía pgcrypto en PostgreSQL)
- **Sesiones**: Tiempo de expiración configurable y revocación explícita
- **Prevención de ataques**:
  - XSS: Cookies HTTP-Only
  - CSRF: Tokens específicos y SameSite
  - Inyección SQL: Consultas parametrizadas
  - Fuerza bruta: Rate limiting en funciones de autenticación

## Compatibilidad con Edge Runtime

- El middleware es liviano y evita operaciones de base de datos
- Las API de autenticación usan runtime Node.js (`export const runtime = 'nodejs'`)
- Funciones específicas en `edge-utils.ts` para operaciones seguras en Edge

## Instalación y Configuración

1. Ejecutar scripts SQL:
   - `auth_sessions.sql`: Crea la tabla de sesiones
   - `auth_functions.sql`: Define las funciones de autenticación

2. Configurar variables de entorno:
   ```
   DATABASE_URL=postgres://usuario:contraseña@tu-base-datos.neon.tech/educlub
   ```

3. Verificar que las consultas funcionan correctamente en `src/lib/session.ts`

## Notas Adicionales

- La validación de sesiones en el middleware es liviana para optimizar rendimiento
- Las operaciones de base de datos se hacen en rutas API específicas con runtime Node.js
- La implementación es compatible con Next.js App Router
- El sistema actual soporta "Mantener sesión iniciada" con TTL configurable