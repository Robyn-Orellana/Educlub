"use client";

import { useState, useEffect, FormEvent } from 'react';
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

  // Registro inline (sin redirigir a /register)
  const [showSignup, setShowSignup] = useState(false);
  const [role, setRole] = useState<'student' | 'tutor'>('student');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState<string | null>(null);
  const [courses, setCourses] = useState<Array<{id:number; code:string; name:string}>>([]);
  const [selectedEnrollCourses, setSelectedEnrollCourses] = useState<number[]>([]);
  const [selectedTutorCourses, setSelectedTutorCourses] = useState<number[]>([]);

  useEffect(() => {
    // Cargar cursos cuando se abra el formulario o al montar
    async function loadCourses() {
      try {
        const res = await fetch('/api/courses');
        const data = await res.json();
        if (res.ok && data?.courses) setCourses(data.courses);
      } catch {}
    }
    loadCourses();
  }, []);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ocurrió un error al iniciar sesión';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setSignupError(null);
    setSignupSuccess(null);
    setSignupLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          first_name: firstName,
          last_name: lastName,
          email: signupEmail,
          password: signupPassword,
          enroll_course_ids: role === 'student' ? selectedEnrollCourses : [],
          tutor_course_ids: role === 'tutor' ? selectedTutorCourses : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar');
  // Prellenar campos de login y cerrar el formulario de registro
  setEmail(signupEmail);
  setPassword(signupPassword);
  // Resetear y ocultar el formulario de registro
  setRole('student');
  setFirstName('');
  setLastName('');
  setSignupEmail('');
  setSignupPassword('');
  setSelectedEnrollCourses([]);
  setSelectedTutorCourses([]);
  setSignupSuccess(null);
  setShowSignup(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setSignupError(message);
    } finally {
      setSignupLoading(false);
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
              <button 
                type="button"
                onClick={() => setShowSignup(s => !s)}
                className="w-full border border-slate-200 rounded-lg py-3 bg-white hover:bg-slate-50"
                disabled={isLoading}
              >
                {showSignup ? 'Ocultar creación de cuenta' : 'Crear nueva cuenta'}
              </button>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4"></div>

            <p className="text-xs text-slate-400 mt-4">
              Al continuar aceptas las políticas de uso y privacidad de la universidad.
            </p>
          </form>

          {showSignup && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-semibold mb-3">Crear nueva cuenta</h3>
              {signupError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {signupError}
                </div>
              )}
              {signupSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
                  {signupSuccess}
                </div>
              )}
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Rol</label>
                    <select
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-200"
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'student' | 'tutor')}
                      disabled={signupLoading}
                    >
                      <option value="student">Estudiante</option>
                      <option value="tutor">Tutor</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Correo</label>
                    <input
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-200"
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                      disabled={signupLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Nombre</label>
                    <input
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-200"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      disabled={signupLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Apellido</label>
                    <input
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-200"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      disabled={signupLoading}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Contraseña</label>
                  <input
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-violet-200"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    disabled={signupLoading}
                  />
                </div>
                {/* Selección de cursos según rol */}
                {role === 'student' && (
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Cursos a inscribirse</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-auto border border-slate-200 rounded-lg p-3">
                      {courses.map(c => {
                        const checked = selectedEnrollCourses.includes(c.id);
                        return (
                          <label key={`enroll-${c.id}`} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedEnrollCourses(prev => e.target.checked
                                  ? [...prev, c.id]
                                  : prev.filter(id => id !== c.id)
                                );
                              }}
                              disabled={signupLoading}
                            />
                            <span>{c.code} · {c.name}</span>
                          </label>
                        );
                      })}
                      {courses.length === 0 && (
                        <span className="text-xs text-slate-400">No hay cursos disponibles</span>
                      )}
                    </div>
                  </div>
                )}
                {role === 'tutor' && (
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Cursos a tutorizar</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-auto border border-slate-200 rounded-lg p-3">
                      {courses.map(c => {
                        const checked = selectedTutorCourses.includes(c.id);
                        return (
                          <label key={`tutor-${c.id}`} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setSelectedTutorCourses(prev => e.target.checked
                                  ? [...prev, c.id]
                                  : prev.filter(id => id !== c.id)
                                );
                              }}
                              disabled={signupLoading}
                            />
                            <span>{c.code} · {c.name}</span>
                          </label>
                        );
                      })}
                      {courses.length === 0 && (
                        <span className="text-xs text-slate-400">No hay cursos disponibles</span>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-lg disabled:opacity-60"
                    disabled={signupLoading}
                  >
                    {signupLoading ? 'Creando...' : 'Crear cuenta'}
                  </button>
                  <button
                    type="button"
                    className="border px-6 py-3 rounded-lg"
                    onClick={() => setShowSignup(false)}
                    disabled={signupLoading}
                  >
                    Cancelar
                  </button>
                </div>
                <p className="text-xs text-slate-400">Nota: Puedes cambiar tus cursos luego desde tu perfil.</p>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}