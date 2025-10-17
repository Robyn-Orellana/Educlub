import React from 'react';
import RatingsList from './ratings-list';

export const dynamic = 'force-dynamic';

export default function CalificacionesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Calificaciones</h1>
      <p className="text-sm text-gray-600">Lista de tutores y estudiantes, con sus cursos y la opción de calificarlos.</p>
      <RatingsList />
    </div>
  );
}
