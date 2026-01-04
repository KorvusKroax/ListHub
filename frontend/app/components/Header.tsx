'use client';

import { useAuth } from './AuthProvider';

export default function Header() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="bg-black text-gray-100 p-4">

      <div className="max-w-5xl mx-auto flex justify-between items-center">

        <h1 className="text-4xl font-bold">ListHub</h1>

        {!loading && user && (<span>Hello, <strong>{user.username}</strong>!</span>)}

        {!loading && user && (
          <button
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition duration-200"
            onClick={logout}
          >
            Kijelentkezés
          </button>
        )}

      </div>
    </header>
  );
}
