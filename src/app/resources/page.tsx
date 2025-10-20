import React from 'react';
import ResourcesClient from './resourcesClient';

export default function ResourcesPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Recursos</h1>
      <p className="text-gray-600">Sube archivos directamente a Firebase Storage y visualiza el listado por semestre y curso.</p>
      <ResourcesClient />
    </div>
  );
}
