"use client";

import React from 'react';
import CalendarView from './CalendarView';

type TutorSession = {
  session_id: number;
  course_code: string;
  course_name: string;
  scheduled_at: string;
  duration_min: number;
  platform: string;
  status: string;
  total_reservas: number;
};

export default function CalendarClient({ sessions }: { sessions: TutorSession[] }) {
  React.useEffect(() => {
    const links = [
      'https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@6.1.19/main.min.css',
      'https://cdn.jsdelivr.net/npm/@fullcalendar/timegrid@6.1.19/main.min.css',
    ];

    const created: HTMLLinkElement[] = [];
    links.forEach((href) => {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = href;
        document.head.appendChild(l);
        created.push(l);
      }
    });

    return () => {
      // cleanup injected links
      created.forEach((l) => l.remove());
    };
  }, []);

  return <CalendarView sessions={sessions} />;
}
