# Firebase Security Rules (alineadas al módulo de Recursos)

Pega y ajusta en Firebase Console → Firestore/Storage Rules según tus necesidades.

## Firestore Rules (recomendadas)

Estas reglas permiten leer cualquier recurso autenticado y crear documentos en `resources` solo al usuario autenticado, validando el shape de los datos. Evitan comparaciones frágiles de timestamps (como `request.time == createdAt`).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }

    match /resources/{id} {
      // Cualquiera autenticado puede leer
      allow read: if isSignedIn();

      // Solo el usuario autenticado puede crear su propio recurso
      allow create: if isSignedIn()
        && request.resource.data.uploaderId == request.auth.uid
        && request.resource.data.title is string
        && request.resource.data.semesterId is string
        && request.resource.data.courseId is string
        && request.resource.data.contentType is string
        && request.resource.data.size is int
        && request.resource.data.storagePath is string
        && request.resource.data.downloadURL is string
        && request.resource.data.createdAt is string
        && request.resource.data.updatedAt is string;

      // Opcional: permitir borrar solo al dueño. Actualizaciones deshabilitadas por simplicidad.
      allow delete: if isSignedIn() && resource.data.uploaderId == request.auth.uid;
      allow update: if false;
    }
  }
}
```

Notas:
- Si necesitas validar el patrón de `storagePath`, puedes usar una regex simple: `request.resource.data.storagePath.matches('^resources/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+/.+')`.
- Si quieres restringir a semestres 1..10, valida que el valor sea uno de esos strings.

## Storage Rules

Las siguientes reglas permiten lectura a usuarios autenticados y escritura a usuarios autenticados con tamaño < 1GB y cualquier contentType.

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isSignedIn() { return request.auth != null; }
    match /resources/{semesterId}/{courseId}/{resourceId}/{filename} {
      allow read: if isSignedIn(); // o true si deseas público
      allow write: if isSignedIn()
        && request.resource.size < 1024 * 1024 * 1024 // < 1GB
        && request.resource.contentType.matches('.*');
    }
  }
}
```
