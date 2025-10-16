"use client";

import React from 'react';
import { useState } from 'react';
import FullCalendar from '@fullcalendar/react'; // requires installation
import type { EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
// Styles are injected from the client wrapper to avoid bundler resolution issues

type TutorSession = {
  session_id: number;
  course_code: string;
  course_name: string;
  scheduled_at: string;
  duration_min: number;
  platform: string;
  status: string;
  total_reservas: number;
};

export default function CalendarView({ sessions }: { sessions: TutorSession[] }) {
  const [selected, setSelected] = useState<TutorSession | null>(null);

  const events = sessions.map((s) => ({
    id: String(s.session_id),
    // Show the scheduled time inside the title so it appears on month cells
    title: `${new Date(s.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${s.course_code} — ${s.course_name}`,
    start: s.scheduled_at,
    end: new Date(new Date(s.scheduled_at).getTime() + s.duration_min * 60000).toISOString(),
    extendedProps: s,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-3 bg-white p-4 rounded-lg shadow-sm">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          // Ensure event times are shown when possible and format them
          displayEventTime={true}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          events={events}
          eventClick={(info: EventClickArg) => {
            setSelected(info.event.extendedProps as TutorSession);
          }}
          height="auto"
        />
      </div>

      <aside className="bg-white p-4 rounded-lg shadow-sm">
        <h3 className="font-semibold mb-2">Detalles</h3>
        {selected ? (
          <div>
            <p className="text-sm"><strong>Curso:</strong> {selected.course_code} — {selected.course_name}</p>
            <p className="text-sm"><strong>Fecha:</strong> {new Date(selected.scheduled_at).toLocaleString()}</p>
            <p className="text-sm"><strong>Duración:</strong> {selected.duration_min} minutos</p>
            <p className="text-sm"><strong>Plataforma:</strong> {selected.platform}</p>
            <p className="text-sm"><strong>Reservas:</strong> {selected.total_reservas}</p>
            <p className="text-sm"><strong>Estado:</strong> {selected.status}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Haz clic en una sesión para ver detalles.</p>
        )}
      </aside>
    </div>
  );
}
