"use client";
import React, { useState } from 'react';
import ProfileEditor from './ProfileEditor';

export default function EditProfileToggle() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Actualiza tu nombre, rol y avatar.</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
        >
          {open ? 'Cerrar edición' : 'Editar perfil'}
        </button>
      </div>

      {open && (
        <div className="mt-4">
          <ProfileEditor />
        </div>
      )}
    </div>
  );
}
