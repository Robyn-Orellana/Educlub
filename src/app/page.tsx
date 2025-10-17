import { redirect } from 'next/navigation';
import { getServerSession } from '../lib/session';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const s = await getServerSession();
  if (s.isAuthenticated) {
    redirect('/dashboard');
  }
  redirect('/login');
}
