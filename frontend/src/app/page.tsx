"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ListEntity } from '@/types/list';
import { apiFetch } from '@/lib/api';

export default function Home() {
  const [lists, setLists] = useState<ListEntity[]>([]);
  const [newListName, setNewListName] = useState('');
  const router = useRouter();
  const { isAuthenticated, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('http://localhost:8080/api/lists')
        .then(res => res.json())
        .then(setLists)
        .catch(err => console.error('API error:', err));
    }
  }, [isAuthenticated]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const res = await apiFetch('http://localhost:8080/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName }),
      });
      if (res.ok) {
        const newList = await res.json();
        setLists([...lists, newList]);
        setNewListName('');
      }
    } catch (err) {
      console.error('Create list error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-100">My Lists</h1>
          <button
            onClick={logout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>

        <form onSubmit={handleCreateList} className="bg-gray-800 rounded-lg shadow-md p-4 mb-6 border border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="New list name..."
              className="flex-1 px-3 py-2 border border-gray-700 rounded bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!newListName.trim()}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-600 transition"
            >
              Create
            </button>
          </div>
        </form>

        {lists.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No shopping lists yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lists.map((list) => (
              <Link
                key={list.id}
                href={`/lists/${list.id}`}
                className="bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer border border-gray-700"
              >
                <h2 className="text-xl font-semibold text-gray-100 mb-2">
                  {list.name}
                </h2>
                <p className="text-gray-400 text-sm">Click to view items</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
