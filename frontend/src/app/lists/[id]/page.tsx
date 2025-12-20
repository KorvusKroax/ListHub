"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ListDetail, Item } from '@/types/list';
import { apiFetch } from '@/lib/api';

export default function ListDetailPage() {
  const [list, setList] = useState<ListDetail | null>(null);
  const [editName, setEditName] = useState(list?.name || '');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [sharedUsers, setSharedUsers] = useState<{id:number; username:string; email:string}[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const listId = params.id as string;

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    apiFetch(`http://localhost:8080/api/lists/${listId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(setList)
      .catch(err => {
        console.error('API error:', err);
        router.push('/');
      })
      .finally(() => setLoading(false));
  }, [isAuthenticated, listId, router]);

  useEffect(() => {
    if (!isAuthenticated || !listId) return;

    apiFetch(`http://localhost:8080/api/lists/${listId}/users`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load shared users');
        return res.json();
      })
      .then(setSharedUsers)
      .catch(() => setSharedUsers([]));
  }, [isAuthenticated, listId]);

  const handleUpdateList = async () => {
    if (!editName.trim()) return;
    try {
      const res = await apiFetch(`http://localhost:8080/api/lists/${listId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
      });
      if (res.ok) {
        const updated = await res.json();
        setList(prev => prev ? { ...prev, name: updated.name } : null);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Update list error:', err);
    }
  };

  const handleDeleteList = async () => {
    if (!confirm(`Delete list "${list?.name}"?`)) return;
    try {
      await apiFetch(`http://localhost:8080/api/lists/${listId}`, {
        method: 'DELETE',
      });
      router.push('/');
    } catch (err) {
      console.error('Delete list error:', err);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setAddingItem(true);
    try {
      const response = await apiFetch(`http://localhost:8080/api/lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItemName }),
      });

      if (response.ok) {
        const newItem = await response.json();
        setList(prev => prev ? { ...prev, items: [...prev.items, newItem] } : null);
        setNewItemName('');
      }
    } catch (err) {
      console.error('Add item error:', err);
    } finally {
      setAddingItem(false);
    }
  };

  const handleToggleItem = async (itemId: number, nextChecked: boolean) => {
    try {
      const res = await apiFetch(`http://localhost:8080/api/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isChecked: nextChecked }),
      });
      if (res.ok) {
        const updated: Item = await res.json();
        setList(prev => prev
          ? { ...prev, items: prev.items.map(i => i.id === itemId ? updated : i) }
          : null
        );
      }
    } catch (err) {
      console.error('Update item error:', err);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    try {
      const response = await apiFetch(`http://localhost:8080/api/items/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setList(prev => prev ? { ...prev, items: prev.items.filter(i => i.id !== itemId) } : null);
      }
    } catch (err) {
      console.error('Delete item error:', err);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareUsername.trim()) return;
    try {
      const res = await apiFetch(`http://localhost:8080/api/lists/${listId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: shareUsername }),
      });
      if (res.ok || res.status === 201) {
        const data = await res.json();
        const user = data.user ?? null;
        if (user) setSharedUsers(prev => [...prev, user]);
        setShareUsername('');
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleUnshare = async (userId: number) => {
    try {
      const res = await apiFetch(`http://localhost:8080/api/lists/${listId}/share/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok || res.status === 204) {
        setSharedUsers(prev => prev.filter(u => u.id !== userId));
      }
    } catch (err) {
      console.error('Unshare error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  if (!list) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-500 hover:underline mb-4 inline-block">
          ← Back to Lists
        </Link>

        <div className="flex items-center justify-between gap-4 mb-6">
          {isEditing ? (
            <div className="flex gap-2 flex-1">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-700 rounded bg-gray-900 text-gray-100"
              />
              <button
                onClick={handleUpdateList}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditName(list?.name || '');
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-100">{list.name}</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowShareModal(true)}
                  className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                >
                  Share
                </button>
                <button
                  onClick={handleDeleteList}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowShareModal(false)}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-700" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-100">Share List</h2>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleShare} className="mb-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUsername}
                    onChange={(e) => setShareUsername(e.target.value)}
                    placeholder="Username to share with..."
                    className="flex-1 px-3 py-2 border border-gray-700 rounded bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={!shareUsername.trim()}
                    className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-gray-600 transition"
                  >
                    Add
                  </button>
                </div>
              </form>

              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">Shared with:</h3>
                {sharedUsers.length === 0 ? (
                  <p className="text-gray-400 text-sm">No one yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {sharedUsers.map(u => (
                      <li key={u.id} className="flex items-center justify-between bg-gray-900 p-3 rounded">
                        <div>
                          <p className="text-gray-200 font-medium">{u.username}</p>
                          <p className="text-gray-500 text-sm">{u.email}</p>
                        </div>
                        <button
                          onClick={() => handleUnshare(u.id)}
                          className="text-red-500 hover:text-red-400 px-3 py-1 rounded transition text-sm"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleAddItem} className="bg-gray-800 rounded-lg shadow-md p-4 mb-6 border border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Add new item..."
              className="flex-1 px-3 py-2 border border-gray-700 rounded bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={addingItem}
            />
            <button
              type="submit"
              disabled={addingItem || !newItemName.trim()}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-600 transition"
            >
              Add
            </button>
          </div>
        </form>

        <div className="bg-gray-800 rounded-lg shadow-md border border-gray-700">
          {list.items.length === 0 ? (
            <p className="p-6 text-center text-gray-400">No items yet. Add one above!</p>
          ) : (
            <ul className="divide-y divide-gray-700">
              {list.items.map((item) => (
                <li key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-700">
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={item.isChecked}
                      onChange={() => handleToggleItem(item.id, !item.isChecked)}
                      className="h-4 w-4"
                    />
                    <span className={item.isChecked ? 'line-through text-gray-400' : 'text-gray-100'}>
                      {item.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="text-red-500 hover:text-red-700 px-3 py-1 rounded transition"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
