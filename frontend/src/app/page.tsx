"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ListEntity, ListGroup } from '@/types/list';
import { apiFetch } from '@/lib/api';

export default function Home() {
  const [listGroups, setListGroups] = useState<ListGroup[]>([]);
  const [standaloneLists, setStandaloneLists] = useState<ListEntity[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newListName, setNewListName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const router = useRouter();
  const { isAuthenticated, loading, logout } = useAuth();

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
      // Betöltjük a csoportokat
      const groupsRes = await apiFetch('http://localhost:8080/api/list-groups');
      const groupsData: ListGroup[] = await groupsRes.json();
      setListGroups(groupsData);

      // Betöltjük az önálló listákat (amelyek nem tartoznak csoporthoz)
      const listsRes = await apiFetch('http://localhost:8080/api/lists');
      const standaloneLists: ListEntity[] = await listsRes.json();
      setStandaloneLists(standaloneLists);
    } catch (err) {
      console.error('API error:', err);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const res = await apiFetch('http://localhost:8080/api/list-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName }),
      });
      if (res.ok) {
        setNewGroupName('');
        setShowGroupModal(false);
        loadData();
      }
    } catch (err) {
      console.error('Create group error:', err);
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
          name: newListName,
          listGroupId: selectedGroupId
        }),
      });
      if (res.ok) {
        setNewListName('');
        setSelectedGroupId(null);
        setShowListModal(false);
        loadData();
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
          <h1 className="text-3xl font-bold text-gray-100">ListHub</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowGroupModal(true)}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition"
            >
              + New Group
            </button>
            <button
              onClick={() => setShowListModal(true)}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition"
            >
              + New List
            </button>
            <button
              onClick={logout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Egységes kártya nézet: ListGroup-ok és Listák */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* ListGroup-ok */}
          {listGroups.map((group) => (
            <Link
              key={`group-${group.id}`}
              href={`/listgroups/${group.id}`}
              className="bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer border border-purple-700"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-purple-400">📁</span>
                <h2 className="text-xl font-semibold text-gray-100">{group.name}</h2>
              </div>
              <p className="text-gray-400 text-sm">{group.listCount ?? 0} lists</p>
            </Link>
          ))}

          {/* Standalone ListEntity-k */}
          {standaloneLists.map((list) => (
            <Link
              key={`list-${list.id}`}
              href={`/lists/${list.id}`}
              className="bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition cursor-pointer border border-gray-700"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-blue-400">📝</span>
                <h2 className="text-xl font-semibold text-gray-100">{list.name}</h2>
              </div>
              <p className="text-gray-400 text-sm">
                {(list.completedCount ?? 0)}/{list.itemCount ?? 0} items checked
              </p>
            </Link>
          ))}
        </div>

        {listGroups.length === 0 && standaloneLists.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg">No groups or lists yet. Create one to get started!</p>
          </div>
        )}

        {/* New Group Modal */}
        {showGroupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowGroupModal(false)}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-700" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-100">New Group</h2>
                <button
                  onClick={() => setShowGroupModal(false)}
                  className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateGroup}>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Group name..."
                  className="w-full px-3 py-2 border border-gray-700 rounded bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowGroupModal(false)}
                    className="px-4 py-2 text-gray-400 hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newGroupName.trim()}
                    className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-gray-600 transition"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* New List Modal */}
        {showListModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => { setShowListModal(false); setSelectedGroupId(null); }}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-700" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-100">New List</h2>
                <button
                  onClick={() => { setShowListModal(false); setSelectedGroupId(null); }}
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

                {!selectedGroupId && (
                  <div className="mb-4">
                    <label className="block text-gray-400 text-sm mb-2">Add to group (optional):</label>
                    <select
                      value={selectedGroupId ?? ''}
                      onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-3 py-2 border border-gray-700 rounded bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">No group (standalone)</option>
                      {listGroups.map((group) => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => { setShowListModal(false); setSelectedGroupId(null); }}
                    className="px-4 py-2 text-gray-400 hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newListName.trim()}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-600 transition"
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
