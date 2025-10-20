"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ThreadLikeButton({ threadId, liked, count }: { threadId: number; liked: boolean; count: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function toggle() {
    setLoading(true);
    try {
      await fetch(`/api/forums/${threadId}/like`, { method: 'POST' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }
  return (
    <button disabled={loading} onClick={toggle} className="text-sm flex items-center gap-1">
      <span className={liked ? 'text-red-600' : 'text-gray-600'}>❤</span>
      <span>{count}</span>
    </button>
  );
}
