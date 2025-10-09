import React from 'react';
import { getCoursesOverview } from '../../../lib/db';
import CoursesView from './CoursesView';

export default async function Cursos() {
  const courses = await getCoursesOverview();

  return (
    <div>
      <CoursesView courses={courses} />
    </div>
  );
}
