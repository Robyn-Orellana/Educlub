"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type LogoutButtonProps = {
  className?: string;
  children?: React.ReactNode;
};

export default function LogoutButton({ className, children }: LogoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  const handleLogout = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al cerrar sesión');
      }
      
      // Redireccionar a la página de inicio
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error durante el logout:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className={className || "text-red-600 hover:text-red-800 transition-colors"}
    >
      {isLoading ? 'Cerrando sesión...' : (children || 'Cerrar sesión')}
    </button>
  );
}