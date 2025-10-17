import React from 'react';

import CalendarView from './CalendarView';

export default function CalendarioPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Calendario 📅</h1>
        <p className="text-gray-600">Selecciona un día y luego una hora para agendar sesiones.</p>
      </div>

      <CalendarView />
    </div>
  );
}
