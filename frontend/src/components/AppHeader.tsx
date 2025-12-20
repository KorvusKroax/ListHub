"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AppHeader() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const pathname = usePathname();

  // Ne jelenjen meg a header a login oldalon
  if (pathname === '/login') {
    return null;
  }

  return (
    <header className="bg-gray-950 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-3 py-3 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3 text-gray-100 hover:text-white">
          <Image src="/icon.svg" alt="ListHub" width={32} height={32} className="rounded-md" />
          <span className="text-3xl font-bold">ListHub</span>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-4 text-sm text-gray-300">
          {loading ? (
            <span className="text-gray-500">Checking session...</span>
          ) : isAuthenticated && user ? (
            <span className="font-normal">
              Signed in as <span className="font-semibold text-white">{user.username}</span>
            </span>
          ) : (
            <span className="text-gray-500">Not signed in</span>
          )}

          <button
            onClick={logout}
            className="bg-red-500 text-white px-3 py-1.5 rounded hover:bg-red-600 transition text-sm"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
