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
  const [showListModal, setShowListModal] = useState(false);
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      const listsRes = await apiFetch('http://localhost:8080/api/lists');
      const listsData: ListEntity[] = await listsRes.json();
      setLists(listsData);
    } catch (err) {
      console.error('API error:', err);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const res = await apiFetch('http://localhost:8080/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newListName
        }),
      });
      if (res.ok) {
        setNewListName('');
        setShowListModal(false);
        loadData();
      }
    } catch (err) {
      console.error('Create list error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <main className="bg-gray-950 text-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="space-y-10">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-gray-100">My Lists</h2>
              </div>
              <button
                onClick={() => setShowListModal(true)}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
              >
                + New List
              </button>
            </div>

            {lists.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lists.map((list) => (
                  <Link
                    key={`list-${list.id}`}
                    href={`/lists/${list.id}`}
                    className="bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer border border-gray-700"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-gray-400">📝</span>
                      <h3 className="text-xl font-semibold text-gray-100">{list.name}</h3>
                    </div>
                    <p className="text-gray-400 text-sm">
                      {(list.completedCount ?? 0)}/{list.itemCount ?? 0} items checked
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-sm bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
                No lists yet. Create one to get started.
              </div>
            )}
          </section>
        </div>

        {/* New List Modal */}
        {showListModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowListModal(false)}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-700" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-100">New List</h2>
                <button
                  onClick={() => setShowListModal(false)}
                  className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateList}>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="List name..."
                  className="w-full px-3 py-2 border border-gray-700 rounded bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                  autoFocus
                />

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowListModal(false)}
                    className="px-4 py-2 text-gray-400 hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newListName.trim()}
                    className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:bg-gray-700 transition"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
