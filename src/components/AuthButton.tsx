"use client";
import React, { useEffect, useState } from 'react';
import { getClientAuth, GoogleAuthProvider } from '../lib/firebase';
import { signInWithPopup, onAuthStateChanged, signOut, type User } from 'firebase/auth';

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u: User | null) => setUser(u));
  }, []);

  async function login() {
    try {
      const auth = getClientAuth();
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert('No se pudo iniciar sesión: ' + msg + '\nRevisa que las variables NEXT_PUBLIC_FB_* estén configuradas y que Google esté habilitado en Firebase Auth.');
      throw e;
    }
  }
  async function logout() {
    const auth = getClientAuth();
    await signOut(auth);
  }

  if (!user) {
    return (
      <button onClick={login} className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">Login con Google</button>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-gray-700">{user.displayName || user.email} ({user.uid.slice(0,6)}…)</div>
      <button onClick={logout} className="px-3 py-1.5 rounded border hover:bg-gray-50">Logout</button>
    </div>
  );
}
