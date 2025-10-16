import { getAllCourses } from '../../lib/db';
import RegisterForm from './RegisterForm';

export default async function RegisterPage() {
  const courses = (await getAllCourses()) as { id: number; code: string; name: string }[];
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-3xl w-full bg-white p-8 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-4">Crear nueva cuenta</h1>
        <RegisterForm courses={courses} />
      </div>
    </div>
  );
}
