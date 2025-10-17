"use client";
import React, { useEffect, useMemo, useState } from 'react';

type CalendarCell = {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
};

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// Todas las 24 horas del día: 00..23
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, months: number) {
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + months);
  return nd;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date) {
  const nd = new Date(d);
  nd.setHours(0, 0, 0, 0);
  return nd;
}

function isBeforeDay(a: Date, b: Date) {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

function getMonthGrid(viewDate: Date): CalendarCell[] {
  const first = startOfMonth(viewDate);
  // Convert to ISO weekday index (Mon=0..Sun=6)
  const isoWeekdayOfFirst = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - isoWeekdayOfFirst);

  const today = new Date();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      date: d,
      isCurrentMonth: d.getMonth() === viewDate.getMonth(),
      isToday: isSameDay(d, today),
    });
  }
  return cells;
}

export default function CalendarView() {
  const now = new Date();
  const [viewDate, setViewDate] = useState<Date>(startOfMonth(now));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  // key: YYYY-MM-DD -> list of events for preview/list
  const [eventsByDate, setEventsByDate] = useState<Record<string, Array<{ time: string; partner?: string | null; course?: string | null; url?: string | null }>>>({});
  const [courseCode, setCourseCode] = useState<string>('');
  const [counterpartyId, setCounterpartyId] = useState<string>('');
  const [courses, setCourses] = useState<Array<{ id:number; code:string; name:string }>>([]);
  const [participants, setParticipants] = useState<{ tutors: Array<{id:number; name:string; email:string}>; students: Array<{id:number; name:string; email:string}>}>({ tutors: [], students: [] });
  const [userRole, setUserRole] = useState<'tutor' | 'student' | 'admin' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [tutorIsActor, setTutorIsActor] = useState<boolean>(true);

  const monthLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
    const txt = fmt.format(viewDate);
    // Capitalizar primera letra por estética
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }, [viewDate]);

  const cells = useMemo(() => getMonthGrid(viewDate), [viewDate]);

  const closePicker = () => {
    setSelectedDate(null);
    setSelectedHour(null);
    setCourseCode('');
    setCounterpartyId('');
    setErrorMsg(null);
    setLoading(false);
    setTutorIsActor(true);
  };

  const isHourDisabledForDate = (date: Date, hour: number) => {
    const now = new Date();
    if (isBeforeDay(date, now)) return true; // todo el día pasado
    if (isSameDay(date, now)) {
      // Bloquea horas ya transcurridas y la hora actual en curso
      return hour <= now.getHours();
    }
    return false;
  };

  const onPickHour = (hour: number) => {
    if (!selectedDate) return;
    if (isHourDisabledForDate(selectedDate, hour)) return; // ignorar selección no válida
    setSelectedHour(hour);
    // Placeholder: podríamos mantener abierto hasta Confirmar
  };

  const onDayClick = (d: Date, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) {
      // Navegar al mes de la celda y seleccionar el día
      setViewDate(startOfMonth(d));
    }
    setSelectedDate(d);
  };

  const goPrevMonth = () => setViewDate((d) => startOfMonth(addMonths(d, -1)));
  const goNextMonth = () => setViewDate((d) => startOfMonth(addMonths(d, 1)));
  const goToday = () => setViewDate(startOfMonth(new Date()));

  // Cargar sesiones reales desde el servidor para el mes en vista
  useEffect(() => {
    (async () => {
      try {
        const start = new Date(viewDate);
        start.setDate(1); start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1); // inicio del siguiente mes
        const res = await fetch(`/api/sessions?from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(end.toISOString())}`);
        const data = await res.json();
        if (res.ok && data?.ok) {
          const map: Record<string, Array<{ time: string; partner?: string | null; course?: string | null; url?: string | null }>> = {};
          const fmtTime = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
          for (const s of data.sessions as Array<{ scheduled_at: string; join_url?: string | null; partner_name?: string | null; course_name?: string | null }>) {
            const key = String(s.scheduled_at).slice(0,10);
            const list = map[key] || [];
            list.push({
              time: fmtTime.format(new Date(s.scheduled_at)),
              partner: s.partner_name ?? null,
              course: s.course_name ?? null,
              url: s.join_url ?? null,
            });
            map[key] = list;
          }
          setEventsByDate(map);
        } else {
          setEventsByDate({});
        }
      } catch {
        setEventsByDate({});
      }
    })();
  }, [viewDate]);

  // Escucha un evento global para refrescar sesiones (aceptar/rechazar desde notificaciones)
  useEffect(() => {
    const handler = () => setViewDate((d) => new Date(d));
    window.addEventListener('educlub:calendar:refresh', handler);
    return () => window.removeEventListener('educlub:calendar:refresh', handler);
  }, []);

  // Cargar cursos del usuario y rol de sesión
  useEffect(() => {
    (async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          fetch('/api/courses'),
          fetch('/api/auth/session')
        ]);
        const cData = await cRes.json();
        const sData = await sRes.json();
        if (cRes.ok && cData?.courses) setCourses(cData.courses);
        if (sRes.ok && sData?.userRole) setUserRole(sData.userRole as 'tutor' | 'student' | 'admin');
      } catch {}
    })();
  }, []);

  // Cuando cambia el curso, cargar tutores/estudiantes del curso
  useEffect(() => {
    (async () => {
      if (!courseCode.trim()) { setParticipants({ tutors: [], students: [] }); return; }
      try {
        const res = await fetch(`/api/course-participants?course_code=${encodeURIComponent(courseCode.trim())}`);
        const data = await res.json();
        if (res.ok && data?.ok) {
          setParticipants({ tutors: data.tutors || [], students: data.students || [] });
          setCounterpartyId(''); // resetear selección
        }
      } catch {}
    })();
  }, [courseCode]);

  return (
    <div className="w-full">
      {/* Header con navegación de mes */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={goPrevMonth} className="px-2 py-1 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100" aria-label="Mes anterior">←</button>
          <button onClick={goNextMonth} className="px-2 py-1 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100" aria-label="Mes siguiente">→</button>
        </div>
        <div className="text-base font-semibold">{monthLabel}</div>
        <div>
          <button onClick={goToday} className="px-3 py-1.5 rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100 text-sm">Hoy</button>
        </div>
      </div>

      {/* Encabezado de días */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-500">{d}</div>
        ))}
      </div>

      {/* Grilla 6x7 (42 celdas) */}
      <div className="grid grid-cols-7 grid-rows-6 gap-2">
        {cells.map((c, idx) => {
          const dayNum = c.date.getDate();
          const isSelected = selectedDate ? isSameDay(c.date, selectedDate) : false;
          const base = 'aspect-square w-full rounded-lg border transition flex items-center justify-center text-sm';
          const tone = c.isCurrentMonth
            ? 'bg-white border-gray-200 hover:border-violet-300 text-gray-800'
            : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300';
          const sel = isSelected ? 'ring-2 ring-violet-500 border-violet-500' : '';
          const today = c.isToday ? 'relative after:content-[""] after:absolute after:bottom-1 after:w-1.5 after:h-1.5 after:rounded-full after:bg-violet-500' : '';
          const key = c.date.toISOString().slice(0,10);
          const evts = eventsByDate[key] || [];
          return (
            <button
              key={idx}
              onClick={() => onDayClick(c.date, c.isCurrentMonth)}
              className={[base, tone, sel, today].filter(Boolean).join(' ')}
              aria-label={`Seleccionar ${c.date.toDateString()}`}
            >
              <div className="flex flex-col items-center gap-1 px-1 text-center w-full h-full p-1">
                <div className="text-base font-medium leading-none">{dayNum}</div>
                {/* Preview: hasta 3 eventos con hora + contraparte */}
                {evts.slice(0,3).map((e, i) => (
                  <div key={i} className="w-full text-[10px] text-violet-700 truncate" title={[e.time, e.partner].filter(Boolean).join(' · ')}>
                    {e.time}{e.partner ? ` · ${e.partner}` : ''}
                  </div>
                ))}
                {evts.length > 3 && (
                  <div className="w-full text-[10px] text-gray-500">+{evts.length - 3} más</div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selector de hora */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="text-sm text-gray-600">Selecciona hora</div>
              <button className="text-gray-400 hover:text-gray-600" onClick={closePicker} aria-label="Cerrar">✕</button>
            </div>

            {/* Lista de reuniones del día seleccionado */}
            {selectedDate && (
              <div className="px-4 pb-3">
                <div className="text-xs text-gray-500 mb-1">Sesiones reservadas este día</div>
                {(() => {
                  const key = selectedDate.toISOString().slice(0,10);
                  const evts = eventsByDate[key] || [];
                  if (evts.length === 0) return <div className="text-xs text-gray-500">No hay sesiones este día.</div>;
                  return (
                    <div className="flex flex-col gap-2 max-h-40 overflow-auto pr-1">
                      {evts.map((e, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-xs">
                          <div className="text-gray-700 truncate">
                            <span className="font-medium text-violet-700">{e.time}</span>
                            {e.partner ? ` · ${e.partner}` : ''}
                            {e.course ? ` · ${e.course}` : ''}
                          </div>
                          {e.url && (
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded-md bg-violet-600 text-white hover:bg-violet-700">Unirse</a>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="px-4 py-3">
              <div className="text-base font-medium mb-2">
                {new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(selectedDate)}
              </div>
              {/* Datos requeridos para crear la sesión */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Curso</label>
                  <select
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                  >
                    <option value="">Seleccionar curso</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.code}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Contraparte</label>
                  <select
                    value={counterpartyId}
                    onChange={(e) => setCounterpartyId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                    disabled={!courseCode}
                  >
                    <option value="">Seleccionar</option>
                    {userRole === 'student' && participants.tutors.map(u => (
                      <option key={`t-${u.id}`} value={String(u.id)}>{u.name} · {u.email}</option>
                    ))}
                    {userRole === 'tutor' && participants.students.map(u => (
                      <option key={`s-${u.id}`} value={String(u.id)}>{u.name} · {u.email}</option>
                    ))}
                    {userRole === 'admin' && (
                      <>
                        <optgroup label="Tutores">
                          {participants.tutors.map(u => (
                            <option key={`t-${u.id}`} value={String(u.id)}>{u.name} · {u.email}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Estudiantes">
                          {participants.students.map(u => (
                            <option key={`s-${u.id}`} value={String(u.id)}>{u.name} · {u.email}</option>
                          ))}
                        </optgroup>
                      </>
                    )}
                  </select>
                </div>
              </div>
              {/* Si ambos son estudiantes, permitir decidir quién actúa como tutor */}
              {userRole === 'student' && participants.students.some(s => String(s.id) === counterpartyId) && (
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">Quién actúa como tutor</label>
                  <div className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-1">
                      <input type="radio" name="who_tutor" checked={tutorIsActor} onChange={() => setTutorIsActor(true)} />
                      Yo
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="radio" name="who_tutor" checked={!tutorIsActor} onChange={() => setTutorIsActor(false)} />
                      La contraparte
                    </label>
                  </div>
                </div>
              )}
              {errorMsg && (
                <div className="mb-2 text-xs text-red-600">{errorMsg}</div>
              )}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {HOURS.map((h) => {
                  const disabled = isHourDisabledForDate(selectedDate, h);
                  const isSelected = selectedHour === h && !disabled;
                  const base = 'px-3 py-2 rounded-lg border text-sm transition';
                  const tone = disabled
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                    : isSelected
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300 hover:text-violet-700';
                  return (
                    <button
                      key={h}
                      onClick={() => onPickHour(h)}
                      disabled={disabled}
                      aria-disabled={disabled}
                      title={disabled ? 'Hora pasada' : undefined}
                      className={[base, tone].join(' ')}
                    >
                      {String(h).padStart(2, '0')}:00
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
              <button onClick={closePicker} className="px-3 py-2 text-sm rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100">Cancelar</button>
              <button
                disabled={
                  selectedHour == null ||
                  (selectedHour != null && isHourDisabledForDate(selectedDate, selectedHour)) ||
                  !courseCode.trim() || !counterpartyId.trim() || loading
                }
                className={`px-3 py-2 text-sm rounded-md text-white ${
                  selectedHour == null || (selectedHour != null && isHourDisabledForDate(selectedDate, selectedHour)) || !courseCode.trim() || !counterpartyId.trim() || loading
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-violet-600 hover:bg-violet-700'
                }`}
                onClick={() => {
                  if (!selectedDate || selectedHour == null) return;
                  if (!courseCode.trim() || !counterpartyId.trim()) {
                    setErrorMsg('Ingresa código de curso e ID de contraparte');
                    return;
                  }
                  setErrorMsg(null);
                  setLoading(true);
                  const when = new Date(selectedDate);
                  when.setHours(selectedHour, 0, 0, 0);
                  // actor_is_host: por defecto el creador es el host
                  // Excepción: si ambos son estudiantes, usa el radio "Quién actúa como tutor"
                  const cpId = Number(counterpartyId);
                  const cpIsStudent = participants.students.some(u => u.id === cpId);
                  const actorIsHost = (userRole === 'student' && cpIsStudent) ? tutorIsActor : true;

                  const payload = {
                    course_code: courseCode.trim(),
                    counterparty_user_id: Number(counterpartyId),
                    scheduled_at: when.toISOString(),
                    duration_min: 60,
                    platform: 'meet' as const,
                    // No crear reserva automáticamente; el invitado decidirá
                    create_reservation: false,
                    // Compat con función anterior y nueva v2
                    tutor_is_actor: tutorIsActor,
                    actor_is_host: actorIsHost, // en la semántica nueva, host = quien actúa como tutor según relación
                  };
                  fetch('/api/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                  })
                    .then(async (r) => {
                      const data = await r.json();
                      if (!r.ok || !data?.ok) {
                        throw new Error(data?.error || 'No se pudo agendar la sesión');
                      }
                      // Tras crear, refrescamos el fetch del mes
                      setViewDate((d) => new Date(d));
                    })
                    .catch((e) => setErrorMsg((e instanceof Error ? e.message : String(e)) || 'Error al agendar'))
                    .finally(() => {
                      setLoading(false);
                      if (!errorMsg) closePicker();
                    });
                }}
              >
                {loading ? 'Agendando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
