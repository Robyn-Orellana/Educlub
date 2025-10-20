export type ResourceItem = {
  id: string;
  userId: number;
  userName?: string;
  semester: string; // e.g., 2025-1
  courseId: number;
  courseCode: string;
  courseName?: string;
  title: string;
  description?: string;
  originalName: string;
  contentType: string;
  size: number;
  storageKey: string; // S3 key
  publicUrl: string;
  createdAt: string; // ISO
};

export type ListResourcesResponse = {
  ok: true;
  resources: ResourceItem[];
} | { ok: false; error: string };

export type PresignResourceRequest = {
  semester: string;
  courseId: number;
  courseCode: string;
  fileName: string;
  contentType: string;
};

export type PresignResourceResponse = {
  ok: true;
  url: string;
  key: string;
  publicUrl: string;
} | { ok: false; error: string };

export type FinalizeResourceRequest = {
  semester: string;
  courseId: number;
  courseCode: string;
  courseName?: string;
  title: string;
  description?: string;
  originalName: string;
  contentType: string;
  size: number;
  storageKey: string;
  publicUrl: string;
};

export type FinalizeResourceResponse = {
  ok: true;
  id: string;
} | { ok: false; error: string };
