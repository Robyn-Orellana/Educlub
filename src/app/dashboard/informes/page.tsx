import React from 'react';
import SessionsReport from './sessions-report';
import ParticipantsReport from './participants-report';

export const dynamic = 'force-dynamic';

export default function InformesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Informes</h1>
        <p className="text-sm text-gray-600">Descarga o imprime reportes de sesiones y participantes por curso.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <SessionsReport />
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <ParticipantsReport />
        </div>
      </div>
    </div>
  );
}
