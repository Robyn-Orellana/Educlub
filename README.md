Este es un proyecto trabajado con NextJs, Vercel y Neon.

El cual consiste en crear una comunidad universitaria de apoyo virtual, tanto con tutorias como dudas por parte de los estudiantes, con el fin de mejorar la comunicacion esntre los mismos y mejorar la calidad de educacion.

## Integración de Firebase (cliente, sin servidor)

Subida directa a Firebase Storage desde el navegador con el SDK web (modular v10). Los metadatos se guardan en Firestore. No usamos servidores intermedios.

Archivos clave:

- `src/lib/firebase.ts`: inicialización cliente y exports `auth`, `db`, `storage` con protección SSR.
- `src/lib/resources.ts`: utilidades (fetch paginado y `formatBytes`).
- `src/components/AuthButton.tsx`: login/logout con Google.
- `src/components/ResourceUploader.tsx`: subida con progreso y guardado en Firestore.
- `src/app/resources/page.tsx`: página principal de recursos.
- `src/app/resources/resourcesClient.tsx`: lógica de selección y listado (client component).
- `docs/security-rules.md`: reglas mínimas de Firestore/Storage.
- `.env.local.example`: variables públicas `NEXT_PUBLIC_*`.

### Variables de entorno

Crea `.env.local` a partir de `.env.local.example` con las claves públicas del proyecto Firebase:

- `NEXT_PUBLIC_FB_API_KEY`
- `NEXT_PUBLIC_FB_AUTH_DOMAIN`
- `NEXT_PUBLIC_FB_PROJECT_ID`
- `NEXT_PUBLIC_FB_STORAGE_BUCKET`
- `NEXT_PUBLIC_FB_APP_ID`

Estas son claves públicas; no exponen secretos. El upload debe hacerse en el cliente (navegador) usando el SDK web.

### Reglas de seguridad

Ver `docs/security-rules.md` y pégalos en la consola de Firebase. Ajusta según tus roles.

### Cómo correr

1. Instala dependencias
2. Crea `.env.local`
3. Ejecuta en dev

Opcional: pnpm también funciona si usas pnpm.

### Uso

1. Navega a `/resources`.
2. Login con Google.
3. Selecciona semestre y curso (TODO: reemplazar combos por tu catálogo real).
4. Sube un archivo (progreso en tiempo real). Verás el ítem en la lista con botón de descarga.

### Notas

- Límite de 1GB por archivo (ajustable en reglas y validación).
- Costos/cuotas: revisar el plan de Firebase para Firestore/Storage.

