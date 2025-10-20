import { collection, getDocs, limit, orderBy, query, startAfter, where, type DocumentData, type QueryDocumentSnapshot, type Timestamp } from 'firebase/firestore';
import { getClientDb } from './firebase';

export type ResourceDoc = {
  id: string;
  title: string;
  semesterId: string;
  courseId: string;
  uploaderId: string;
  roleAtUpload?: 'student' | 'tutor' | 'admin';
  contentType: string;
  size: number;
  storagePath: string;
  downloadURL: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

export async function fetchResourcesPage(params: { semesterId: string; courseId: string; pageSize?: number; after?: QueryDocumentSnapshot<DocumentData> | null; }): Promise<{ items: ResourceDoc[]; last: QueryDocumentSnapshot<DocumentData> | null; }>
{
  const { semesterId, courseId, pageSize = 20, after = null } = params;
  const db = getClientDb();
  let qRef = query(
    collection(db, 'resources'),
    where('semesterId', '==', semesterId),
    where('courseId', '==', courseId),
    // Ordenar por timestamp de servidor si está disponible
    orderBy('createdAtTs', 'desc'),
    limit(pageSize)
  );
  if (after) {
    qRef = query(qRef, startAfter(after));
  }
  const snap = await getDocs(qRef);
  type ResourceData = Omit<ResourceDoc, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: string; updatedAt?: string; createdAtTs?: Timestamp; updatedAtTs?: Timestamp };
  const items = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => {
    const data = d.data() as ResourceData;
    // Asegurar createdAt/updatedAt como ISO string para la UI
    let createdAt: string = data.createdAt ?? '';
    if (!createdAt && data.createdAtTs) {
      createdAt = (data.createdAtTs as Timestamp).toDate().toISOString();
    }
    let updatedAt: string = data.updatedAt ?? '';
    if (!updatedAt && data.updatedAtTs) {
      updatedAt = (data.updatedAtTs as Timestamp).toDate().toISOString();
    }
  const { createdAtTs: _catIgnored2, updatedAtTs: _uatIgnored2, ...rest } = data as Record<string, unknown>;
    return { id: d.id, ...(rest as Omit<ResourceDoc, 'id' | 'createdAt' | 'updatedAt'>), createdAt, updatedAt } as ResourceDoc;
  }) as ResourceDoc[];
  const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return { items, last };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(val >= 100 ? 0 : val >= 10 ? 1 : 2)} ${sizes[i]}`;
}
