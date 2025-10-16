import React from 'react';
import { getFirstUser, getSessionsForTutor } from '../../../lib/db';
import CalendarClient from './CalendarClient';

export default async function Calendario() {
  // Demo: usamos el primer usuario que sea tutor (en un sistema real, usar el usuario autenticado)
  const first = await getFirstUser();
  if (!first) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Calendario</h1>
        <p className="text-gray-600">No se encontró usuarios en la base de datos.</p>
      </div>
    );
  }

  // para demo, tratamos al primer usuario como tutor
  const tutorId = Number(first.id);
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const sessions = await getSessionsForTutor(tutorId, from, to);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Calendario — Vista de tutor</h1>

      {sessions.length === 0 ? (
        <p className="text-gray-600">No hay sesiones programadas en los próximos 7 días.</p>
      ) : (
        <div>
          {/* CalendarView es un componente cliente que muestra las sesiones en un calendario interactivo */}
          {/* Requiere instalar: @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction */}
          {/* Renderizamos un wrapper cliente que importa y muestra el calendario */}
          <CalendarClient sessions={sessions} />
        </div>
      )}
    </div>
  );
}
