"use client";
import React, { useState } from 'react';
import TutorCoursesManager from './TutorCoursesManager';

export default function TutorCoursesToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Elige los cursos que impartes como tutor.</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
        >
          {open ? 'Cerrar' : 'Cambiar cursos'}
        </button>
      </div>

      {open && (
        <div className="mt-4">
          <TutorCoursesManager />
        </div>
      )}
    </div>
  );
}
