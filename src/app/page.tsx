"use client";

import React, { useState } from "react";
import Image from "next/image";

export default function Home() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, simulate auth
    alert(`${mode === "login" ? "Iniciar sesión" : "Crear cuenta"} (simulado)`);
  };

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
              <h2 className="text-2xl font-bold text-slate-800">{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
              <p className="text-sm text-slate-500 mt-1">{mode === "login" ? "Ingresa con tu correo institucional" : "Regístrate como estudiante o tutor"}</p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <Image src="/file.svg" alt="Icon" width={28} height={28} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-sm text-slate-600 mb-1">Nombre completo</label>
                <input className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-200" type="text" name="fullname" placeholder="Juan Pérez" required />
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-600 mb-1">Correo institucional</label>
              <input className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-200" type="email" name="email" placeholder="usuario@umg.edu.gt" required />
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">Contraseña</label>
              <div className="flex items-center gap-2">
                <input className="flex-1 px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-200" type={showPassword ? "text" : "password"} name="password" placeholder="********" required />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="text-sm text-violet-600 font-semibold">{showPassword ? 'Ocultar' : 'Mostrar'}</button>
              </div>
            </div>

            {mode === "signup" && (
              <div>
                <label className="block text-sm text-slate-600 mb-1">Confirmar contraseña</label>
                <input className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-200" type={showPassword ? "text" : "password"} name="confirmPassword" placeholder="********" required />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold py-3 rounded-lg shadow hover:scale-[1.01] transition-transform" type="submit">{mode === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
              <button type="button" onClick={() => setMode(m => m === 'login' ? 'signup' : 'login')} className="flex-1 border border-slate-200 py-3 rounded-lg bg-white">{mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Tienes cuenta? Inicia sesión'}</button>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <hr className="flex-1 border-slate-200" />
              <span className="text-sm text-slate-400">o</span>
              <hr className="flex-1 border-slate-200" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <button type="button" className="flex items-center justify-center gap-2 border border-slate-200 rounded-lg py-3 bg-white hover:bg-slate-50"> 
                <svg width="18" height="18" viewBox="0 0 48 48" className="inline-block" aria-hidden><path fill="#EA4335" d="M24 9.5v8.4h13.6C36.7 21.4 31.8 14.8 24 9.5z"/><path fill="#34A853" d="M9.9 19.3A14.9 14.9 0 0 0 24 28.5c3.9 0 6.6-1.3 8.9-2.8l6.5 5c-4 3.7-9.3 6.1-15.5 6.1A24 24 0 0 1 9.9 19.3z"/><path fill="#4A90E2" d="M24 39.5c6.2 0 11.5-2.4 15.5-6.1l-6.5-5c-2 1.3-4.9 2.6-8.9 2.6-6.2 0-11.3-4.1-13.1-9.7l-6.6 5.1A24 24 0 0 0 24 39.5z"/><path fill="#FBBC05" d="M24 9.5c3.6 0 6.1 1.3 7.9 2.4l5.9-5.9C31.7 2.6 27.9 1 24 1 15.9 1 9.4 4.9 5.3 10.4l6.6 5.1C12.7 12 17.8 9.5 24 9.5z"/></svg>
                Continuar con Google
              </button>
              <button type="button" onClick={() => alert('Acceso como invitado (simulado)')} className="flex items-center justify-center gap-2 rounded-lg py-3 bg-gradient-to-r from-amber-400 to-pink-400 text-white font-semibold">Acceder como invitado</button>
            </div>

            <p className="text-xs text-slate-400 mt-4">Al continuar aceptas las políticas de uso y privacidad de la universidad.</p>
          </form>
        </main>
      </div>
    </div>
  );
}
