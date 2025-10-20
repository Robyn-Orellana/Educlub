import React from 'react';
import ResourcesClient from "../../resources/resourcesClient";

export default function Page() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Recursos</h1>
        <p className="text-gray-600">
          Biblioteca digital con guías, presentaciones y ejercicios.
        </p>
      </div>

      <ResourcesClient />
    </div>
  );
}
