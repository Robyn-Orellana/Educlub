"use client";

import { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = useSearchParams();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, remember }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }

  // Redirección a next query param o dashboard
  const next = search.get('next');
  router.push(next && next.startsWith('/') ? next : '/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-purple-50 to-white p-6">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="hidden md:flex flex-col justify-center pl-8">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-400 flex items-center justify-center text-white text-2xl font-bold shadow-lg">E</div>
              <div>
                <h1 className="text-3xl font-extrabold text-slate-800">EduClub</h1>
                <p className="text-sm text-slate-600">Tutorías virtuales · UMG Campus Jutiapa</p>
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-md rounded-xl p-6 shadow-md">
            <h2 className="text-2xl font-semibold text-slate-800 mb-3">Aprende en tu tiempo</h2>
            <p className="text-slate-600">Conecta con tutores, accede a materiales alineados al pensum y organiza tus sesiones en un solo lugar.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="p-4 bg-gradient-to-br from-purple-50 to-cyan-50 rounded-lg border border-white/60">
                <h3 className="text-sm font-semibold">Foros</h3>
                <p className="text-xs text-slate-500 mt-1">Discute dudas y comparte conocimiento.</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-50 to-cyan-50 rounded-lg border border-white/60">
                <h3 className="text-sm font-semibold">Calendario</h3>
                <p className="text-xs text-slate-500 mt-1">Agenda y recibe recordatorios.</p>
              </div>
            </div>
          </div>
        </div>

        <main className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Iniciar sesión</h2>
              <p className="text-sm text-slate-500 mt-1">Ingresa con tu correo institucional</p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Image src="/file.svg" alt="Icon" width={28} height={28} />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1" htmlFor="email">Correo institucional</label>
              <input 
                id="email"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-200" 
                type="email" 
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@umg.edu.gt" 
                required 
                disabled={isLoading}
              />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1" htmlFor="password">Contraseña</label>
              <div className="flex items-center gap-2">
                <input 
                  id="password"
                  className="flex-1 px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-200" 
                  type={showPassword ? "text" : "password"} 
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********" 
                  required
                  disabled={isLoading}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(s => !s)} 
                  className="text-sm text-violet-600 font-semibold"
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 text-violet-600 focus:ring-violet-500 rounded"
              />
              <label htmlFor="remember" className="ml-2 block text-sm text-gray-700">
                Mantener sesión iniciada
              </label>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <button 
                className="w-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold py-3 rounded-lg shadow hover:scale-[1.01] transition-transform disabled:opacity-60" 
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Iniciando sesión...' : 'Entrar'}
              </button>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <hr className="flex-1 border-slate-200" />
              <span className="text-sm text-slate-400">o</span>
              <hr className="flex-1 border-slate-200" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
             
            </div>

            <p className="text-xs text-slate-400 mt-4">
              Al continuar aceptas las políticas de uso y privacidad de la universidad.
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}