"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ListDetail, Item, ListEntity } from '@/types/list';
import { apiFetch } from '@/lib/api';
import Spinner from '@/components/Spinner';
import { ToastProvider, useToast } from '@/contexts/ToastContext';

// Generate a unique negative temp ID to avoid collisions and allow race-safe checks
const makeTempId = () => -Math.floor(Date.now() + Math.random() * 1e6);

interface SublistItemProps {
  sublist: ListEntity;
  onDelete: (id: number) => void;
}

function SublistItem({ sublist, onDelete }: SublistItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sublistDetails, setSublistDetails] = useState<ListDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [newSublistName, setNewSublistName] = useState('');
  const [addingSublist, setAddingSublist] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(sublist.name);
  const [nameDraft, setNameDraft] = useState(sublist.name);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemName, setEditingItemName] = useState('');
  const toast = useToast();

  const loadSublistDetails = async () => {
    if (sublistDetails) return; // Already loaded
    setLoading(true);
    try {
      const res = await apiFetch(`http://localhost:8080/api/lists/${sublist.id}`);
      if (res.ok) {
        const data = await res.json();
        setSublistDetails(data);
      } else {
        toast.error('Failed to load sublist.');
      }
    } catch (err) {
      console.error('Load sublist error:', err);
      toast.error('Failed to load sublist.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!isExpanded && !sublistDetails) {
      loadSublistDetails();
    }
    setIsExpanded(!isExpanded);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    // Optimista UI frissítés - azonnal megjelenít temp itemet
    const tempId = makeTempId();
    const tempItem: Item = {
      id: tempId, // Temp ID
      name: newItemName,
      isChecked: false,
    };
    setSublistDetails(prev => prev ? { ...prev, items: [...prev.items, tempItem] } : null);
    setNewItemName('');
    setAddingItem(true);

    try {
      const response = await apiFetch(`http://localhost:8080/api/lists/${sublist.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItemName }),
      });

      if (response.ok) {
        const newItem = await response.json();
        // Kicseréli a temp itemet az API-tól kapott itemre
        setSublistDetails(prev => {
          if (!prev) return null;
          // Ha a temp item időközben törölve lett, nem szúrjuk vissza
          const tempStillExists = prev.items.some(i => i.id === tempId);
          if (!tempStillExists) {
            // Aszinkron módon töröljük a szerveren is
            apiFetch(`http://localhost:8080/api/items/${newItem.id}`, { method: 'DELETE' }).catch(() => {});
            return prev;
          }
          // Kicseréljük a temp itemet az API-tól kapott itemre
          return {
            ...prev,
            items: prev.items.map(i => i.id === tempId ? newItem : i)
          };
        });
      } else {
        // Hiba esetén eltávolítja a temp itemet
        setSublistDetails(prev => prev ? {
          ...prev,
          items: prev.items.filter(i => i.id !== tempId)
        } : null);
        toast.error('Could not add item.');
      }
    } catch (err) {
      console.error('Add item error:', err);
      // Hiba esetén eltávolítja a temp itemet
      setSublistDetails(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => i.id !== tempId)
      } : null);
      toast.error('Could not add item.');
    } finally {
      setAddingItem(false);
    }
  };

  const handleAddSublist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSublistName.trim()) return;

    // Optimista UI frissítés - azonnal megjelenít temp sublistet
    const tempId = makeTempId();
    const tempSublist: ListEntity = {
      id: tempId, // Temp ID
      name: newSublistName,
      itemCount: 0,
      completedCount: 0,
      parentId: sublist.id,
    };
    setSublistDetails(prev => prev ? {
      ...prev,
      children: [...(prev.children || []), tempSublist]
    } : null);
    setNewSublistName('');
    setAddingSublist(true);

    try {
      const response = await apiFetch(`http://localhost:8080/api/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSublistName, parentId: sublist.id }),
      });

      if (response.ok) {
        const newSublist = await response.json();
        // Kicseréli a temp sublistet az API-tól kapott sublistre
        setSublistDetails(prev => {
          if (!prev) return null;
          // Ha a temp sublist időközben törölve lett, nem szúrjuk vissza
          const tempStillExists = (prev.children || []).some(c => c.id === tempId);
          if (!tempStillExists) {
            // Aszinkron módon töröljük a szerveren is
            apiFetch(`http://localhost:8080/api/lists/${newSublist.id}`, { method: 'DELETE' }).catch(() => {});
            return prev;
          }
          // Kicseréljük a temp sublistet az API-tól kapott sublistre
          return {
            ...prev,
            children: (prev.children || []).map(c => c.id === tempId ? { ...newSublist, itemCount: 0, completedCount: 0 } : c)
          };
        });
      } else {
        // Hiba esetén eltávolítja a temp sublistet
        setSublistDetails(prev => prev ? {
          ...prev,
          children: (prev.children || []).filter(c => c.id !== tempId)
        } : null);
        toast.error('Could not add sublist.');
      }
    } catch (err) {
      console.error('Add sublist error:', err);
      // Hiba esetén eltávolítja a temp sublistet
      setSublistDetails(prev => prev ? {
        ...prev,
        children: (prev.children || []).filter(c => c.id !== tempId)
      } : null);
      toast.error('Could not add sublist.');
    } finally {
      setAddingSublist(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameDraft.trim()) return;
    // Optimista UI frissítés
    const oldName = displayName;
    setDisplayName(nameDraft);
    setSublistDetails(prev => prev ? { ...prev, name: nameDraft } : prev);
    setIsEditingName(false);

    try {
      const res = await apiFetch(`http://localhost:8080/api/lists/${sublist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameDraft })
      });
      if (!res.ok) {
        // Visszaállítás hiba esetén
        setDisplayName(oldName);
        setSublistDetails(prev => prev ? { ...prev, name: oldName } : prev);
      }
    } catch (err) {
      console.error('Edit sublist name error:', err);
      setDisplayName(oldName);
      setSublistDetails(prev => prev ? { ...prev, name: oldName } : prev);
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setNameDraft(displayName);
  };

  const startEditSubItem = (item: Item) => {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
  };

  const saveEditSubItem = async () => {
    if (!editingItemId || !editingItemName.trim()) return;
    // Optimista UI frissítés
    const oldName = sublistDetails?.items.find(i => i.id === editingItemId)?.name || '';
    setSublistDetails(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === editingItemId ? { ...i, name: editingItemName } : i)
    } : null);
    setEditingItemId(null);
    setEditingItemName('');

    try {
      const res = await apiFetch(`http://localhost:8080/api/items/${editingItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingItemName })
      });
      if (!res.ok) {
        // Visszaállítás hiba esetén
        setSublistDetails(prev => prev ? {
          ...prev,
          items: prev.items.map(i => i.id === editingItemId ? { ...i, name: oldName } : i)
        } : null);
        toast.error('Could not rename item.');
      }
    } catch (err) {
      console.error('Edit item error:', err);
      setSublistDetails(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === editingItemId ? { ...i, name: oldName } : i)
      } : null);
      toast.error('Could not rename item.');
    }
  };

  const cancelEditSubItem = () => {
    setEditingItemId(null);
    setEditingItemName('');
  };

  const handleToggleItem = async (itemId: number, nextChecked: boolean) => {
    // Optimista UI frissítés - azonnal pipálás
    const oldChecked = sublistDetails?.items.find(i => i.id === itemId)?.isChecked ?? false;
    setSublistDetails(prev => prev
      ? { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, isChecked: nextChecked } : i) }
      : null
    );

    // Temp elem esetén csak lokálisan frissítünk
    if (itemId < 0) return;

    try {
      const res = await apiFetch(`http://localhost:8080/api/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isChecked: nextChecked }),
      });
      if (!res.ok) {
        // Visszaállítás hiba esetén
        setSublistDetails(prev => prev
          ? { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, isChecked: oldChecked } : i) }
          : null
        );
        toast.error('Could not update item.');
      }
    } catch (err) {
      console.error('Update item error:', err);
      // Visszaállítás hiba esetén
      setSublistDetails(prev => prev
        ? { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, isChecked: oldChecked } : i) }
        : null
      );
      toast.error('Could not update item.');
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    // Optimista UI frissítés - azonnal eltávolítja az itemet
    const deletedItem = sublistDetails?.items.find(i => i.id === itemId);
    setSublistDetails(prev => prev ? { ...prev, items: prev.items.filter(i => i.id !== itemId) } : null);

    // Temp elem esetén nem hívunk API-t
    if (itemId < 0) {
      return;
    }

    try {
      const response = await apiFetch(`http://localhost:8080/api/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok && deletedItem) {
        // Hiba esetén visszaállítás
        setSublistDetails(prev => prev ? { ...prev, items: [...prev.items, deletedItem] } : null);
        toast.error('Could not delete item.');
      }
    } catch (err) {
      console.error('Delete item error:', err);
      // Hiba esetén visszaállítás
      if (deletedItem) {
        setSublistDetails(prev => prev ? { ...prev, items: [...prev.items, deletedItem] } : null);
      }
      toast.error('Could not delete item.');
    }
  };

  const handleDeleteSublist = async (childId: number) => {
    if (!confirm('Delete this sublist?')) return;
    // Optimista UI frissítés - azonnal eltávolítja a sublistet
    const deletedSublist = sublistDetails?.children?.find(c => c.id === childId);
    setSublistDetails(prev => prev ? {
      ...prev,
      children: (prev.children || []).filter(c => c.id !== childId)
    } : null);

    // Temp sublist esetén nem hívunk API-t
    if (childId < 0) {
      return;
    }

    try {
      const response = await apiFetch(`http://localhost:8080/api/lists/${childId}`, {
        method: 'DELETE',
      });

      if (!response.ok && deletedSublist) {
        // Hiba esetén visszaállítás
        setSublistDetails(prev => prev ? {
          ...prev,
          children: [...(prev.children || []), deletedSublist]
        } : null);
        toast.error('Could not delete sublist.');
      }
    } catch (err) {
      console.error('Delete sublist error:', err);
      // Hiba esetén visszaállítás
      if (deletedSublist) {
        setSublistDetails(prev => prev ? {
          ...prev,
          children: [...(prev.children || []), deletedSublist]
        } : null);
      }
      toast.error('Could not delete sublist.');
    }
  };

  const isTemp = sublist.id < 0;

  return (
    <div className="border-gray-600">
      <div className="flex items-center justify-between hover:bg-gray-700 p-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isTemp ? (
            <Spinner size={14} />
          ) : (
            <button
              onClick={handleToggle}
              className="text-gray-400 hover:text-gray-200 transition"
            >
              {isExpanded ? '∨' : '>'}
            </button>
          )}
          {isEditingName ? (
            <>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveName();
                  } else if (e.key === 'Escape') {
                    handleCancelEditName();
                  }
                }}
                onBlur={handleCancelEditName}
                autoFocus
                className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-700 rounded bg-gray-900 text-gray-100"
              />
              <button onMouseDown={(e) => e.preventDefault()} onClick={handleSaveName} className="bg-gray-600 text-white px-2 py-1 rounded text-sm shrink-0">Save</button>
              <button onMouseDown={(e) => e.preventDefault()} onClick={handleCancelEditName} className="bg-gray-500 text-white px-2 py-1 rounded text-sm shrink-0">Cancel</button>
            </>
          ) : (
            <>
              <span
                className="text-gray-100 cursor-text"
                onClick={() => { setIsEditingName(true); setNameDraft(displayName); }}
                title="Click to edit"
              >
                {displayName}
              </span>
              <span className="text-xs text-gray-500">
                ({(sublist.completedCount ?? 0)}/{sublist.itemCount ?? 0})
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDelete(sublist.id)}
            disabled={isTemp}
            className="bg-red-600 text-white hover:bg-red-700 px-3 py-1 rounded transition text-sm disabled:bg-gray-600 flex items-center gap-2"
          >
            {isTemp && <Spinner size={12} />}
            <span>Delete</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 ml-4 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm p-1">
              <Spinner size={14} />
              <span>Loading...</span>
            </div>
          )}

          {sublistDetails && (
            <>
              {/* Add Item Form */}
              <form onSubmit={handleAddItem} className="flex gap-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Add item..."
                  className="flex-1 px-2 py-1 text-sm border border-gray-700 rounded bg-gray-900 text-gray-100 placeholder-gray-400"
                  disabled={addingItem}
                />
                <button
                  type="submit"
                  disabled={addingItem || !newItemName.trim()}
                  className="bg-blue-500 text-white px-3 py-1 text-sm rounded hover:bg-blue-600 disabled:bg-gray-600 flex items-center gap-2"
                >
                  {addingItem && <Spinner size={12} />}
                  <span>+Item</span>
                </button>
              </form>

              {/* Add Sublist Form */}
              <form onSubmit={handleAddSublist} className="flex gap-2">
                <input
                  type="text"
                  value={newSublistName}
                  onChange={(e) => setNewSublistName(e.target.value)}
                  placeholder="Add sublist..."
                  className="flex-1 px-2 py-1 text-sm border border-gray-700 rounded bg-gray-900 text-gray-100 placeholder-gray-400"
                  disabled={addingSublist}
                />
                <button
                  type="submit"
                  disabled={addingSublist || !newSublistName.trim()}
                  className="bg-green-500 text-white px-3 py-1 text-sm rounded hover:bg-green-600 disabled:bg-gray-600 flex items-center gap-2"
                >
                  {addingSublist && <Spinner size={12} />}
                  <span>+List</span>
                </button>
              </form>

              {/* Items */}
              {sublistDetails.items.map((item) => {
                const isTemp = item.id < 0;
                return (
                <div key={`item-${item.id}`} className="flex items-center justify-between hover:bg-gray-700 p-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isTemp ? (
                      <Spinner size={14} />
                    ) : (
                      <input
                        type="checkbox"
                        checked={item.isChecked}
                        onChange={() => handleToggleItem(item.id, !item.isChecked)}
                        className="h-4 w-4"
                      />
                    )}
                    {editingItemId === item.id ? (
                      <input
                        type="text"
                        value={editingItemName}
                        onChange={(e) => setEditingItemName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveEditSubItem();
                          } else if (e.key === 'Escape') {
                            cancelEditSubItem();
                          }
                        }}
                        onBlur={cancelEditSubItem}
                        autoFocus
                        className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-700 rounded bg-gray-900 text-gray-100"
                      />
                    ) : (
                      <span
                        className={`cursor-text ${item.isChecked ? 'line-through text-gray-400' : 'text-gray-100'}`}
                        onClick={() => startEditSubItem(item)}
                        title="Click to edit"
                      >
                        {item.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingItemId === item.id ? (
                      <>
                        <button onMouseDown={(e) => e.preventDefault()} onClick={saveEditSubItem} className="bg-gray-600 text-white px-3 py-1 rounded text-sm shrink-0">Save</button>
                        <button onMouseDown={(e) => e.preventDefault()} onClick={cancelEditSubItem} className="bg-gray-500 text-white px-3 py-1 rounded text-sm shrink-0">Cancel</button>
                      </>
                    ) : null}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={isTemp}
                      className="bg-red-600 text-white hover:bg-red-700 px-3 py-1 rounded transition text-sm disabled:bg-gray-600 flex items-center gap-2"
                    >
                      {isTemp && <Spinner size={12} />}
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
              })}

              {/* Nested Sublists */}
              {sublistDetails.children && sublistDetails.children.map((child) => (
                <SublistItem
                  key={`sublist-${child.id}`}
                  sublist={child}
                  onDelete={handleDeleteSublist}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ListDetailContent() {
  const [list, setList] = useState<ListDetail | null>(null);
  const [editName, setEditName] = useState(list?.name || '');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [newSublistName, setNewSublistName] = useState('');
  const [addingSublist, setAddingSublist] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemName, setEditingItemName] = useState('');
  const [shareUsername, setShareUsername] = useState('');
  const [sharedUsers, setSharedUsers] = useState<{id:number; username:string; email:string}[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const listId = params.id as string;
  const toast = useToast();

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
        try { toast.error('Failed to load list.'); } catch {}
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
    // Optimista UI frissítés a címnél is
    const oldName = list?.name || '';
    setList(prev => prev ? { ...prev, name: editName } : prev);
    setIsEditing(false);

    try {
      const res = await apiFetch(`http://localhost:8080/api/lists/${listId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
      });
      if (!res.ok) {
        // Visszaállítás hiba esetén
        setList(prev => prev ? { ...prev, name: oldName } : prev);
        toast.error('Could not rename list.');
      }
    } catch (err) {
      console.error('Update list error:', err);
      setList(prev => prev ? { ...prev, name: oldName } : prev);
      toast.error('Could not rename list.');
    }
  };

  const handleDeleteList = async () => {
    if (!confirm(`Delete list "${list?.name}"?`)) return;
    try {
      await apiFetch(`http://localhost:8080/api/lists/${listId}`, {
        method: 'DELETE',
      });
      if (list?.parentId) {
        router.push(`/lists/${list.parentId}`);
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('Delete list error:', err);
      toast.error('Could not delete list.');
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    // Optimista UI frissítés - azonnal megjelenít temp itemet
    const tempId = makeTempId();
    const tempItem: Item = {
      id: tempId, // Temp ID
      name: newItemName,
      isChecked: false,
    };
    setList(prev => prev ? { ...prev, items: [...prev.items, tempItem] } : null);
    setNewItemName('');
    setAddingItem(true);

    try {
      const response = await apiFetch(`http://localhost:8080/api/lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newItemName }),
      });

      if (response.ok) {
        const newItem = await response.json();
        // Kicseréli a temp itemet az API-tól kapott itemre
        setList(prev => {
          if (!prev) return null;
          // Ha a temp item időközben törölve lett, nem szúrjuk vissza
          const tempStillExists = prev.items.some(i => i.id === tempId);
          if (!tempStillExists) {
            // Aszinkron módon töröljük a szerveren is
            apiFetch(`http://localhost:8080/api/items/${newItem.id}`, { method: 'DELETE' }).catch(() => {});
            return prev;
          }
          // Kicseréljük a temp itemet az API-tól kapott itemre
          return {
            ...prev,
            items: prev.items.map(i => i.id === tempId ? newItem : i)
          };
        });
      } else {
        // Hiba esetén eltávolítja a temp itemet
        setList(prev => prev ? {
          ...prev,
          items: prev.items.filter(i => i.id !== tempId)
        } : null);
        toast.error('Could not add item.');
      }
    } catch (err) {
      console.error('Add item error:', err);
      // Hiba esetén eltávolítja a temp itemet
      setList(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => i.id !== tempId)
      } : null);
      toast.error('Could not add item.');
    } finally {
      setAddingItem(false);
    }
  };

  const handleAddSublist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSublistName.trim()) return;

    // Optimista UI frissítés - azonnal megjelenít temp sublistet
    const tempId = makeTempId();
    const tempSublist: ListEntity = {
      id: tempId, // Temp ID
      name: newSublistName,
      itemCount: 0,
      completedCount: 0,
      parentId: parseInt(listId),
    };
    setList(prev => prev ? {
      ...prev,
      children: [...(prev.children || []), tempSublist]
    } : null);
    setNewSublistName('');
    setAddingSublist(true);

    try {
      const response = await apiFetch(`http://localhost:8080/api/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSublistName, parentId: listId }),
      });

      if (response.ok) {
        const newSublist = await response.json();
        // Kicseréli a temp sublistet az API-tól kapott sublistre
        setList(prev => {
          if (!prev) return null;
          // Ha a temp sublist időközben törölve lett, nem szúrjuk vissza
          const tempStillExists = (prev.children || []).some(c => c.id === tempId);
          if (!tempStillExists) {
            // Aszinkron módon töröljük a szerveren is
            apiFetch(`http://localhost:8080/api/lists/${newSublist.id}`, { method: 'DELETE' }).catch(() => {});
            return prev;
          }
          // Kicseréljük a temp sublistet az API-tól kapott sublistre
          return {
            ...prev,
            children: (prev.children || []).map(c => c.id === tempId ? { ...newSublist, itemCount: 0, completedCount: 0 } : c)
          };
        });
      } else {
        // Hiba esetén eltávolítja a temp sublistet
        setList(prev => prev ? {
          ...prev,
          children: (prev.children || []).filter(c => c.id !== tempId)
        } : null);
        toast.error('Could not add sublist.');
      }
    } catch (err) {
      console.error('Add sublist error:', err);
      // Hiba esetén eltávolítja a temp sublistet
      setList(prev => prev ? {
        ...prev,
        children: (prev.children || []).filter(c => c.id !== tempId)
      } : null);
      toast.error('Could not add sublist.');
    } finally {
      setAddingSublist(false);
    }
  };

  const handleToggleItem = async (itemId: number, nextChecked: boolean) => {
    // Optimista UI frissítés - azonnal pipálás
    const oldChecked = list?.items.find(i => i.id === itemId)?.isChecked ?? false;
    setList(prev => prev
      ? { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, isChecked: nextChecked } : i) }
      : null
    );

    // Temp elem esetén csak lokálisan frissítünk
    if (itemId < 0) return;

    try {
      const res = await apiFetch(`http://localhost:8080/api/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isChecked: nextChecked }),
      });
      if (!res.ok) {
        // Visszaállítás hiba esetén
        setList(prev => prev
          ? { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, isChecked: oldChecked } : i) }
          : null
        );
        toast.error('Could not update item.');
      }
    } catch (err) {
      console.error('Update item error:', err);
      // Visszaállítás hiba esetén
      setList(prev => prev
        ? { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, isChecked: oldChecked } : i) }
        : null
      );
      toast.error('Could not update item.');
    }
  }

  const handleDeleteItem = async (itemId: number) => {
    // Optimista UI frissítés - azonnal eltávolítja az itemet
    const deletedItem = list?.items.find(i => i.id === itemId);
    setList(prev => prev ? { ...prev, items: prev.items.filter(i => i.id !== itemId) } : null);

    // Temp elem esetén nem hívunk API-t
    if (itemId < 0) {
      return;
    }

    try {
      const response = await apiFetch(`http://localhost:8080/api/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok && deletedItem) {
        // Hiba esetén visszaállítás
        setList(prev => prev ? { ...prev, items: [...prev.items, deletedItem] } : null);
        toast.error('Could not delete item.');
      }
    } catch (err) {
      console.error('Delete item error:', err);
      // Hiba esetén visszaállítás
      if (deletedItem) {
        setList(prev => prev ? { ...prev, items: [...prev.items, deletedItem] } : null);
      }
      toast.error('Could not delete item.');
    }
  };

  const startEditMainItem = (item: Item) => {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
  };

  const saveEditMainItem = async () => {
    if (!editingItemId || !editingItemName.trim()) return;
    // Optimista UI frissítés
    const oldName = list?.items.find(i => i.id === editingItemId)?.name || '';
    setList(prev => prev ? {
      ...prev,
      items: prev.items.map(i => i.id === editingItemId ? { ...i, name: editingItemName } : i)
    } : null);
    setEditingItemId(null);
    setEditingItemName('');

    try {
      const res = await apiFetch(`http://localhost:8080/api/items/${editingItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingItemName })
      });
      if (!res.ok) {
        // Visszaállítás hiba esetén
        setList(prev => prev ? {
          ...prev,
          items: prev.items.map(i => i.id === editingItemId ? { ...i, name: oldName } : i)
        } : null);
        toast.error('Could not rename item.');
      }
    } catch (err) {
      console.error('Edit item error:', err);
      setList(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === editingItemId ? { ...i, name: oldName } : i)
      } : null);
      toast.error('Could not rename item.');
    }
  };

  const cancelEditMainItem = () => {
    setEditingItemId(null);
    setEditingItemName('');
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareUsername.trim()) return;

    // Optimista UI frissítés - azonnal hozzáadja a felhasználót
    const tempId = makeTempId();
    const tempUser = { id: tempId, username: shareUsername, email: '' };
    setSharedUsers(prev => [...prev, tempUser]);
    setShareUsername('');
    setSharing(true);

    try {
      const res = await apiFetch(`http://localhost:8080/api/lists/${listId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: shareUsername }),
      });
      if (res.ok || res.status === 201) {
        const data = await res.json();
        const user = data.user ?? null;
        if (user) {
          // Ha időközben eltávolították a temp megosztást, töröljük a szerveren is
          let shouldDeleteCreated = false;
          setSharedUsers(prev => {
            const exists = prev.some(u => u.id === tempId);
            if (!exists) {
              shouldDeleteCreated = true;
              return prev;
            }
            return prev.map(u => u.id === tempId ? user : u);
          });
          if (shouldDeleteCreated) {
            try {
              await apiFetch(`http://localhost:8080/api/lists/${listId}/share/${user.id}`, { method: 'DELETE' });
            } catch (_) {}
          }
        }
      } else {
        // Hiba esetén eltávolítja a temp felhasználót
        setSharedUsers(prev => prev.filter(u => u.id !== tempId));
        toast.error('Could not share the list.');
      }
    } catch (err) {
      console.error('Share error:', err);
      // Hiba esetén eltávolítja a temp felhasználót
      setSharedUsers(prev => prev.filter(u => u.id !== tempId));
      toast.error('Could not share the list.');
    } finally {
      setSharing(false);
    }
  };

  const handleUnshare = async (userId: number) => {
    // Optimista UI frissítés - azonnal eltávolítja a felhasználót
    const unsharedUser = sharedUsers.find(u => u.id === userId);
    setSharedUsers(prev => prev.filter(u => u.id !== userId));

    // Temp user esetén nem hívunk API-t
    if (userId < 0) return;

    try {
      const res = await apiFetch(`http://localhost:8080/api/lists/${listId}/share/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204 && unsharedUser) {
        // Hiba esetén visszaállítás
        setSharedUsers(prev => [...prev, unsharedUser]);
        toast.error('Could not remove shared user.');
      }
    } catch (err) {
      console.error('Unshare error:', err);
      // Hiba esetén visszaállítás
      if (unsharedUser) {
        setSharedUsers(prev => [...prev, unsharedUser]);
      }
      toast.error('Could not remove shared user.');
    }
  };

  const handleDeleteSublist = async (childId: number) => {
    if (!confirm('Delete this sublist?')) return;
    // Optimista UI frissítés - azonnal eltávolítja a sublistet
    const deletedSublist = list?.children?.find(c => c.id === childId);
    setList(prev => prev ? {
      ...prev,
      children: (prev.children || []).filter(c => c.id !== childId)
    } : null);

    // Temp sublist esetén nem hívunk API-t
    if (childId < 0) {
      return;
    }

    try {
      const response = await apiFetch(`http://localhost:8080/api/lists/${childId}`, {
        method: 'DELETE',
      });

      if (!response.ok && deletedSublist) {
        // Hiba esetén visszaállítás
        setList(prev => prev ? {
          ...prev,
          children: [...(prev.children || []), deletedSublist]
        } : null);
        toast.error('Could not delete sublist.');
      }
    } catch (err) {
      console.error('Delete sublist error:', err);
      // Hiba esetén visszaállítás
      if (deletedSublist) {
        setList(prev => prev ? {
          ...prev,
          children: [...(prev.children || []), deletedSublist]
        } : null);
      }
      toast.error('Could not delete sublist.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="flex items-center gap-3 text-gray-300">
          <Spinner size={18} />
          <p className="text-xl">Loading...</p>
        </div>
      </div>
    );
  }

  if (!list) {
    return null;
  }

  return (
    <ToastProvider>
    <main className="bg-gray-950 text-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/" className="text-blue-400 hover:underline mb-4 inline-block">
          ← Back to Lists
        </Link>

        <div className="flex items-center justify-between gap-4 mb-6">
          {isEditing ? (
            <div className="flex gap-2 flex-1">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleUpdateList();
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                    setEditName(list?.name || '');
                  }
                }}
                onBlur={() => {
                  setIsEditing(false);
                  setEditName(list?.name || '');
                }}
                autoFocus
                className="flex-1 px-3 py-2 border border-gray-700 rounded bg-gray-900 text-gray-100"
              />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleUpdateList}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Save
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
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
              <h1
                className="text-2xl font-bold text-gray-100 cursor-text"
                title="Click to edit"
                onClick={() => {
                  setIsEditing(true);
                  setEditName(list.name);
                }}
              >
                {list.name}
              </h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowShareModal(true)}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                >
                  Share
                </button>
                <button
                  onClick={handleDeleteList}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
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
                    className="flex-1 px-3 py-2 border border-gray-700 rounded bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                  <button
                    type="submit"
                    disabled={sharing || !shareUsername.trim()}
                    className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:bg-gray-700 transition flex items-center gap-2"
                  >
                    {sharing && <Spinner size={14} />}
                    <span>Add</span>
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
                          className="text-red-400 hover:text-red-300 px-3 py-1 rounded transition text-sm"
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
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-600 transition flex items-center gap-2"
            >
              {addingItem && <Spinner size={14} />}
              <span>Add Item</span>
            </button>
          </div>
        </form>

        <form onSubmit={handleAddSublist} className="bg-gray-800 rounded-lg shadow-md p-4 mb-6 border border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={newSublistName}
              onChange={(e) => setNewSublistName(e.target.value)}
              placeholder="Add new sublist..."
              className="flex-1 px-3 py-2 border border-gray-700 rounded bg-gray-900 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={addingSublist}
            />
            <button
              type="submit"
              disabled={addingSublist || !newSublistName.trim()}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-600 transition flex items-center gap-2"
            >
              {addingSublist && <Spinner size={14} />}
              <span>Add Sublist</span>
            </button>
          </div>
        </form>

        <div>
          {list.items.length === 0 && (!list.children || list.children.length === 0) ? (
            <p className="p-6 text-center text-gray-400">No items or sublists yet. Add some above!</p>
          ) : (
            <div className="divide-y divide-gray-700">
              {/* Items */}
              {list.items.map((item) => {
                const isTemp = item.id < 0;
                return (
                <div key={`item-${item.id}`} className="p-2 flex items-center justify-between hover:bg-gray-700">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isTemp ? (
                      <Spinner size={14} />
                    ) : (
                      <input
                        type="checkbox"
                        checked={item.isChecked}
                        onChange={() => handleToggleItem(item.id, !item.isChecked)}
                        className="h-4 w-4"
                      />
                    )}
                    {editingItemId === item.id ? (
                      <input
                        type="text"
                        value={editingItemName}
                        onChange={(e) => setEditingItemName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            saveEditMainItem();
                          } else if (e.key === 'Escape') {
                            cancelEditMainItem();
                          }
                        }}
                        onBlur={cancelEditMainItem}
                        autoFocus
                        className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-700 rounded bg-gray-900 text-gray-100"
                      />
                    ) : (
                      <span
                        className={`cursor-text ${item.isChecked ? 'line-through text-gray-400' : 'text-gray-100'}`}
                        onClick={() => startEditMainItem(item)}
                        title="Click to edit"
                      >
                        {item.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editingItemId === item.id ? (
                      <>
                        <button onMouseDown={(e) => e.preventDefault()} onClick={saveEditMainItem} className="bg-gray-600 text-white px-3 py-1 rounded text-sm shrink-0">Save</button>
                        <button onMouseDown={(e) => e.preventDefault()} onClick={cancelEditMainItem} className="bg-gray-500 text-white px-3 py-1 rounded text-sm shrink-0">Cancel</button>
                      </>
                    ) : null}
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      disabled={isTemp}
                      className="bg-red-600 text-white hover:bg-red-700 px-3 py-1 rounded transition text-sm disabled:bg-gray-600 flex items-center gap-2"
                    >
                      {isTemp && <Spinner size={12} />}
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
              })}

              {/* Sublists */}
              {list.children && list.children.map((child) => (
                <div key={`sublist-${child.id}`}>
                  <SublistItem sublist={child} onDelete={handleDeleteSublist} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
    </ToastProvider>
  );
}

export default function ListDetailPage() {
  return (
    <ToastProvider>
      <ListDetailContent />
    </ToastProvider>
  );
}
