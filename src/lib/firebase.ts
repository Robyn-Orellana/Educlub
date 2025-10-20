// Firebase Web SDK (modular v10) client-only initialization.
// Nota: Los uploads a Firebase Storage deben hacerse en el CLIENTE.
// - El SDK web usa claves públicas (NEXT_PUBLIC_*) y NO expone secretos del proyecto.
// - No uses el Admin SDK en el cliente.
// - Este módulo es seguro para SSR porque no inicializa Firebase en el servidor; expone funciones que fallan si se usan server-side.

import type { FirebaseApp } from 'firebase/app';
import { getApps, initializeApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import { getAuth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import { getStorage } from 'firebase/storage';
// App Check (opcional, pero necesario si lo tienes enforzado en Storage)
import { initializeAppCheck, ReCaptchaV3Provider, getToken as appCheckGetToken, type AppCheck } from 'firebase/app-check';

export const isBrowser = typeof window !== 'undefined';

function getConfig() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FB_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FB_APP_ID,
  } as const;
  // Validación proactiva para dar un error más claro si falta algo
  const missing: string[] = [];
  if (!cfg.apiKey) missing.push('NEXT_PUBLIC_FB_API_KEY');
  if (!cfg.authDomain) missing.push('NEXT_PUBLIC_FB_AUTH_DOMAIN');
  if (!cfg.projectId) missing.push('NEXT_PUBLIC_FB_PROJECT_ID');
  if (!cfg.storageBucket) missing.push('NEXT_PUBLIC_FB_STORAGE_BUCKET');
  if (!cfg.appId) missing.push('NEXT_PUBLIC_FB_APP_ID');
  if (missing.length > 0) {
    throw new Error(
      `Firebase config incompleta. Falta(n): ${missing.join(', ')}. ` +
      `Configura .env.local con las claves públicas de tu app web en Firebase Console (Project settings → Your apps → SDK setup and config).`
    );
  }
  return cfg;
}

let _app: FirebaseApp | null = null;
let _appCheckInitialized = false;
let _appCheck: AppCheck | null = null;

export function getClientApp(): FirebaseApp {
  if (!isBrowser) throw new Error('getClientApp() solo está disponible en el navegador');
  if (_app) return _app;
  const apps = getApps();
  _app = apps.length ? apps[0]! : initializeApp(getConfig());
  return _app;
}

export function getClientAuth(): Auth {
  return getAuth(getClientApp());
}

export function getClientDb(): Firestore {
  return getFirestore(getClientApp());
}

export function getClientStorage(): FirebaseStorage {
  return getStorage(getClientApp());
}

// Inicializa App Check si hay clave pública configurada o si estamos en modo debug
export function ensureAppCheck(): void {
  if (!isBrowser) return;
  if (_appCheckInitialized) return;
  const app = getClientApp(); // ensure app is initialized before App Check
  // Permitir token de debug en dev si está activado
  if (process.env.NEXT_PUBLIC_FB_APPCHECK_DEBUG === 'true') {
    // @ts-expect-error set debug token in window for App Check
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  const siteKey = process.env.NEXT_PUBLIC_FB_APPCHECK_SITE_KEY;
  if (siteKey) {
    try {
      _appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      _appCheckInitialized = true;
    } catch {
      // ignorar si ya fue inicializado o falla silenciosamente
    }
  }
}

export function getAppCheck(): AppCheck | null {
  return _appCheck;
}

export async function getAppCheckTokenPreview(): Promise<{ hasToken: boolean; prefix: string | null } | null> {
  try {
    const app = getClientApp();
    ensureAppCheck();
    if (!_appCheck) return { hasToken: false, prefix: null };
    const tok = await appCheckGetToken(_appCheck, false);
    const t = tok?.token;
    if (!t) return { hasToken: false, prefix: null };
    return { hasToken: true, prefix: t.slice(0, 12) };
  } catch {
    return { hasToken: false, prefix: null };
  }
}

// Devuelve config pública sin validar (para diagnóstico en UI)
export function getPublicFirebaseConfigSafe(): { projectId: string | null; authDomain: string | null; storageBucket: string | null } {
  return {
    projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID ?? null,
    authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN ?? null,
    storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET ?? null,
  };
}

// Re-export utilidades útiles de Auth
export { GoogleAuthProvider } from 'firebase/auth';
