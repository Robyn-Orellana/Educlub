import React from 'react';
import { getCoursesOverview } from '../../../lib/db';
import CoursesView from './CoursesView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function Cursos() {
  const courses = await getCoursesOverview();

  return (
    <div>
      <CoursesView courses={courses} />
    </div>
  );
}
