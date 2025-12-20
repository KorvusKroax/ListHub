"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ListGroup, ListDetail, Item } from '@/types/list';
import { apiFetch } from '@/lib/api';

export default function ListGroupDetailPage() {
  const [group, setGroup] = useState<ListGroup | null>(null);
  const [expandedLists, setExpandedLists] = useState<Set<number>>(new Set());
  const [listDetails, setListDetails] = useState<Map<number, ListDetail>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [activeListId, setActiveListId] = useState<number | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [sharedUsers, setSharedUsers] = useState<{id:number; username:string; email:string}[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editedItemName, setEditedItemName] = useState('');
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editedListName, setEditedListName] = useState('');
  const updateListCountState = (listId: number, items: Item[]) => {
    setGroup(prev => {
      if (!prev || !prev.lists) return prev;
      const itemCount = items.length;
      const completedCount = items.filter(i => i.isChecked).length;
      return {
        ...prev,
        lists: prev.lists.map(l => l.id === listId ? { ...l, itemCount, completedCount } : l),
      };
    });
  };
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated, user } = useAuth();
  const groupId = params.id as string;

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    loadGroup();
  }, [isAuthenticated, groupId, router]);

  useEffect(() => {
    if (isAuthenticated && groupId) {
      loadSharedUsers();
    }
  }, [isAuthenticated, groupId]);

  const loadGroup = async () => {
    try {
      const res = await apiFetch(`http://localhost:8080/api/list-groups/${groupId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setGroup(data);
    } catch (err) {
      console.error('API error:', err);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const toggleList = async (listId: number) => {
    const newExpanded = new Set(expandedLists);

    if (newExpanded.has(listId)) {
      newExpanded.delete(listId);
      setExpandedLists(newExpanded);
    } else {
      newExpanded.add(listId);
      setExpandedLists(newExpanded);

      // Betöltjük a lista részleteit ha még nincs meg
      if (!listDetails.has(listId)) {
        try {
          const res = await apiFetch(`http://localhost:8080/api/lists/${listId}`);
          if (!res.ok) {
            console.error('Failed to load list details:', res.status);
            return;
          }
          const detail = await res.json();
          const safeDetail: ListDetail = {
            ...detail,
            items: Array.isArray(detail.items) ? detail.items : [],
          };
          setListDetails(new Map(listDetails.set(listId, safeDetail)));
        } catch (err) {
          console.error('Failed to load list details:', err);
        }
      }
    }
  };

  const handleAddList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const res = await apiFetch('http://localhost:8080/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName, listGroupId: groupId }),
      });
      if (res.ok) {
        setNewListName('');
        loadGroup();
      }
    } catch (err) {
      console.error('Add list error:', err);
    }
  };

  const handleAddItem = async (e: React.FormEvent, listId: number) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    try {
      const res = await apiFetch(`http://localhost:8080/api/lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItemName }),
      });
      if (res.ok) {
        const newItem = await res.json();
        const currentDetail = listDetails.get(listId);
        if (currentDetail) {
          setListDetails(new Map(listDetails.set(listId, {
            ...currentDetail,
            items: [...currentDetail.items, newItem]
          })));
        }
        setNewItemName('');
        setActiveListId(null);
      }
    } catch (err) {
      console.error('Add item error:', err);
    }
  };

  const handleToggleItem = async (listId: number, itemId: number, nextChecked: boolean) => {
    try {
      const res = await apiFetch(`http://localhost:8080/api/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isChecked: nextChecked }),
      });
      if (res.ok) {
        const updated: Item = await res.json();
        const currentDetail = listDetails.get(listId);
        if (currentDetail) {
          const updatedItems = currentDetail.items.map(i => i.id === itemId ? updated : i);
          setListDetails(new Map(listDetails.set(listId, {
            ...currentDetail,
            items: updatedItems,
          })));
          updateListCountState(listId, updatedItems);
        }
      }
    } catch (err) {
      console.error('Update item error:', err);
    }
  };

  const handleDeleteItem = async (listId: number, itemId: number) => {
    try {
      const res = await apiFetch(`http://localhost:8080/api/items/${itemId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const currentDetail = listDetails.get(listId);
        if (currentDetail) {
          const updatedItems = currentDetail.items.filter(i => i.id !== itemId);
          setListDetails(new Map(listDetails.set(listId, {
            ...currentDetail,
            items: updatedItems,
          })));
          updateListCountState(listId, updatedItems);
        }
      }
    } catch (err) {
      console.error('Delete item error:', err);
    }
  };

  const handleDeleteList = async (listId: number) => {
    if (!confirm('Delete this list?')) return;

    try {
      await apiFetch(`http://localhost:8080/api/lists/${listId}`, {
        method: 'DELETE',
      });
      loadGroup();
      setExpandedLists(prev => {
        const newSet = new Set(prev);
        newSet.delete(listId);
        return newSet;
      });
      setListDetails(prev => {
        const newMap = new Map(prev);
        newMap.delete(listId);
        return newMap;
      });
    } catch (err) {
      console.error('Delete list error:', err);
    }
  };

  const loadSharedUsers = async () => {
    try {
      const res = await apiFetch(`http://localhost:8080/api/list-groups/${groupId}/users`);
      if (res.ok) {
        const users = await res.json();
        setSharedUsers(users);
      }
    } catch (err) {
      console.error('Load shared users error:', err);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareUsername.trim()) return;

    try {
      const res = await apiFetch(`http://localhost:8080/api/list-groups/${groupId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: shareUsername }),
      });
      if (res.ok) {
        setShareUsername('');
        await loadSharedUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to share group');
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleUnshare = async (userId: number) => {
    try {
      const res = await apiFetch(`http://localhost:8080/api/list-groups/${groupId}/share/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await loadSharedUsers();
      }
    } catch (err) {
      console.error('Unshare error:', err);
    }
  };

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedName.trim()) return;

    try {
      const res = await apiFetch(`http://localhost:8080/api/list-groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedName }),
      });
      if (res.ok) {
        await loadGroup();
        setIsEditing(false);
        setEditedName('');
      }
    } catch (err) {
      console.error('Edit group error:', err);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Are you sure you want to delete this group? All lists in this group will also be affected.')) {
      return;
    }

    try {
      const res = await apiFetch(`http://localhost:8080/api/list-groups/${groupId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/');
      }
    } catch (err) {
      console.error('Delete group error:', err);
    }
  };

  const startEdit = () => {
    setEditedName(group?.name || '');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditedName('');
  };

  const handleEditItem = async (listId: number, itemId: number, e: React.FormEvent) => {
    e.preventDefault();
    if (!editedItemName.trim()) return;

    try {
      const res = await apiFetch(`http://localhost:8080/api/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedItemName }),
      });
      if (res.ok) {
        const updated: Item = await res.json();
        const currentDetail = listDetails.get(listId);
        if (currentDetail) {
          setListDetails(new Map(listDetails.set(listId, {
            ...currentDetail,
            items: currentDetail.items.map(i => i.id === itemId ? updated : i)
          })));
        }
        setEditingItemId(null);
        setEditedItemName('');
      }
    } catch (err) {
      console.error('Edit item error:', err);
    }
  };

  const startEditItem = (item: Item) => {
    setEditingItemId(item.id);
    setEditedItemName(item.name);
  };

  const cancelEditItem = () => {
    setEditingItemId(null);
    setEditedItemName('');
  };

  const handleEditList = async (listId: number, e: React.FormEvent) => {
    e.preventDefault();
    if (!editedListName.trim()) return;

    try {
      const res = await apiFetch(`http://localhost:8080/api/lists/${listId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editedListName }),
      });
      if (res.ok) {
        setEditingListId(null);
        setEditedListName('');
        await loadGroup();
      }
    } catch (err) {
      console.error('Edit list error:', err);
    }
  };

  const startEditList = (list: { id: number; name: string }) => {
    setEditingListId(list.id);
    setEditedListName(list.name);
  };

  const cancelEditList = () => {
    setEditingListId(null);
    setEditedListName('');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-blue-500 hover:underline inline-block">
            ← Back to Home
          </Link>
          {user && (
            <div className="text-sm text-gray-400">
              Signed in as <span className="text-gray-100 font-semibold">{user.username}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <span className="text-4xl">📁</span>
          {isEditing ? (
            <form onSubmit={handleEditGroup} className="flex-1 flex gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-600 rounded bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-gray-100">{group.name}</h1>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                >
                  Share
                </button>
                <button
                  onClick={startEdit}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteGroup}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>

        {/* Új lista hozzáadása */}
        <form onSubmit={handleAddList} className="bg-gray-800 rounded-lg shadow-md p-4 mb-6 border border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="Add new list to group..."
              className="flex-1 px-3 py-2 border border-gray-700 rounded bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              disabled={!newListName.trim()}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-gray-600 transition"
            >
              Add List
            </button>
          </div>
        </form>

        {/* Accordion listák */}
        <div className="space-y-4">
          {group.lists && group.lists.length > 0 ? (
            group.lists.map((list) => {
              const isExpanded = expandedLists.has(list.id);
              const detail = listDetails.get(list.id);

              return (
                <div key={list.id} className="bg-gray-800 rounded-lg border border-gray-700">
                  {/* Accordion fejléc */}
                  {editingListId === list.id ? (
                    <div className="flex items-center gap-2 p-4">
                      <span className="text-2xl">📁</span>
                      <form onSubmit={(e) => handleEditList(list.id, e)} className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={editedListName}
                          onChange={(e) => setEditedListName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-600 rounded bg-gray-900 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          type="submit"
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEditList();
                          }}
                          className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-750"
                      onClick={() => toggleList(list.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{isExpanded ? '📂' : '📁'}</span>
                        <div>
                          <h2 className="text-xl font-semibold text-gray-100">{list.name}</h2>
                          <span className="text-gray-400 text-sm">
                            {(list.completedCount ?? 0)}/{list.itemCount ?? 0} items checked
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditList(list);
                          }}
                          className="text-yellow-500 hover:text-yellow-400 px-3 py-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteList(list.id);
                          }}
                          className="text-red-500 hover:text-red-400 px-3 py-1"
                        >
                          Delete
                        </button>
                        <span className="text-gray-500">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  )}

                  {/* Accordion tartalom */}
                  {isExpanded && detail && Array.isArray(detail.items) && (
                    <div className="p-4 border-t border-gray-700">
                      {/* Új item hozzáadása */}
                      <form onSubmit={(e) => handleAddItem(e, list.id)} className="mb-4">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={activeListId === list.id ? newItemName : ''}
                            onChange={(e) => {
                              setActiveListId(list.id);
                              setNewItemName(e.target.value);
                            }}
                            placeholder="Add item..."
                            className="flex-1 px-3 py-2 border border-gray-600 rounded bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="submit"
                            disabled={activeListId !== list.id || !newItemName.trim()}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-600 transition"
                          >
                            Add
                          </button>
                        </div>
                      </form>

                      {/* Item lista */}
                      {detail.items.length === 0 ? (
                        <p className="text-gray-400 text-sm">No items yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {detail.items.map((item) => (
                            <li key={item.id} className="flex items-center justify-between bg-gray-900 p-3 rounded">
                              {editingItemId === item.id ? (
                                <form onSubmit={(e) => handleEditItem(list.id, item.id, e)} className="flex-1 flex gap-2">
                                  <input
                                    type="text"
                                    value={editedItemName}
                                    onChange={(e) => setEditedItemName(e.target.value)}
                                    className="flex-1 px-3 py-2 border border-gray-600 rounded bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                  />
                                  <button
                                    type="submit"
                                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditItem}
                                    className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                                  >
                                    Cancel
                                  </button>
                                </form>
                              ) : (
                                <>
                                  <div className="flex items-center gap-3 flex-1">
                                    <input
                                      type="checkbox"
                                      checked={item.isChecked}
                                      onChange={() => handleToggleItem(list.id, item.id, !item.isChecked)}
                                      className="h-4 w-4"
                                    />
                                    <span className={item.isChecked ? 'line-through text-gray-400' : 'text-gray-100'}>
                                      {item.name}
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => startEditItem(item)}
                                      className="text-yellow-500 hover:text-yellow-400 px-3 py-1"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(list.id, item.id)}
                                      className="text-red-500 hover:text-red-400 px-3 py-1"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No lists in this group yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowShareModal(false)}>
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-100">Share Group</h2>
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
                  {sharedUsers.map((user) => (
                    <li key={user.id} className="flex items-center justify-between bg-gray-900 p-3 rounded">
                      <div>
                        <p className="text-gray-200 font-medium">{user.username}</p>
                        <p className="text-gray-500 text-sm">{user.email}</p>
                      </div>
                      <button
                        onClick={() => handleUnshare(user.id)}
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
    </main>
  );
}
