"use client";
import React, { useRef, useState } from 'react';
import { getClientDb, getClientStorage, ensureAppCheck } from '../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

type Props = {
  semesterId: string;
  courseId: string;
  uploaderId: string; // uid actual
  roleAtUpload?: 'student' | 'tutor' | 'admin';
  uploaderName?: string | null;
  uploaderEmail?: string | null;
};

function normalizeName(name: string) {
  // Reemplaza caracteres no seguros por "_"
  return name.replace(/[^A-Za-z0-9._-]/g, '_');
}

const MAX_SIZE_BYTES = 1024 * 1024 * 1024; // 1GB
const BLOCKED_EXT = ['.exe', '.sh', '.bat']; // opcional

export default function ResourceUploader({ semesterId, courseId, uploaderId, roleAtUpload, uploaderName, uploaderEmail }: Props) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const taskRef = useRef<ReturnType<typeof uploadBytesResumable> | null>(null);

  const disabled = !semesterId || !courseId || !uploaderId || isUploading;

  function validate(): string | null {
    if (!title.trim()) return 'El título es obligatorio';
    if (!file) return 'Selecciona un archivo';
    if (file.size > MAX_SIZE_BYTES) return 'Archivo demasiado grande (>1GB)';
    const lower = file.name.toLowerCase();
    if (BLOCKED_EXT.some((ext) => lower.endsWith(ext))) return 'Tipo de archivo bloqueado';
    return null;
  }

  function cancelUpload() {
    taskRef.current?.cancel();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) { setError(v); return; }
    if (!file) return;
    try {
      setIsUploading(true);
      setProgress(0);
      // Asegurar App Check antes de usar Storage (si enforcement está activo)
      ensureAppCheck();

      const storage = getClientStorage();
      const db = getClientDb();
      const resourceId = crypto.randomUUID();
      const safeFilename = normalizeName(file.name);
      const storagePath = `resources/${semesterId}/${courseId}/${resourceId}/${safeFilename}`;
      const storageRef = ref(storage, storagePath);

      const task = uploadBytesResumable(storageRef, file, { contentType: file.type || 'application/octet-stream' });
      taskRef.current = task;
      try {
        await new Promise<void>((resolve, reject) => {
          task.on('state_changed', (snapshot) => {
            const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setProgress(Math.round(pct));
          }, (err) => reject(err), () => resolve());
        });
      } catch (uploadErr: unknown) {
        const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
        // Mensaje más claro si es Storage
        setError(`Error al subir a Storage: ${msg}. Verifica: (1) que estés logueado, (2) App Check habilitado, (3) Storage Rules permitan escribir en resources/… y (4) el bucket ${process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET} sea correcto.`);
        throw uploadErr;
      }
      const downloadURL = await getDownloadURL(storageRef);

      const nowIso = new Date().toISOString();
      try {
        await addDoc(collection(db, 'resources'), {
          title: title.trim(),
          semesterId,
          courseId,
          uploaderId,
          roleAtUpload: roleAtUpload ?? null,
          uploaderName: uploaderName ?? null,
          uploaderEmail: uploaderEmail ?? null,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          storagePath,
          downloadURL,
          createdAt: nowIso,
          updatedAt: nowIso,
          createdAtTs: serverTimestamp(),
          updatedAtTs: serverTimestamp(),
        });
      } catch (fsErr: unknown) {
        const msg = fsErr instanceof Error ? fsErr.message : String(fsErr);
        setError(`Error al guardar en Firestore: ${msg}. Asegúrate de haber publicado las Firestore Rules que permiten create en la colección resources y que uploaderId coincida con tu UID.`);
        throw fsErr;
      }
      alert('Recurso subido correctamente');
      setTitle('');
      setFile(null);
      setProgress(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsUploading(false);
      taskRef.current = null;
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 p-4 border rounded bg-white">
      <div>
        <label className="block text-sm font-medium mb-1">Título</label>
        <input className="w-full border rounded px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Guía 1" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Archivo</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={isUploading} />
        {file && <div className="text-xs text-gray-500 mt-1">{file.name} — {(file.size/1024/1024).toFixed(2)} MB</div>}
      </div>
      {isUploading && (
        <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
          <div className="bg-blue-600 h-2" style={{ width: `${progress}%` }} />
          <div className="text-xs text-gray-600 mt-1">{progress}%</div>
          <button type="button" onClick={cancelUpload} className="mt-2 text-sm text-red-600 hover:underline">Cancelar</button>
        </div>
      )}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button disabled={disabled} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60">Subir</button>
      </div>
    </form>
  );
}

