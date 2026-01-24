'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AddItemForm from '@/app/components/AddItemForm';
import ListNodeList from '@/app/components/ListNodeList';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { toggleListNode, deleteListNode, fetchChildren, updateListNode } from '@/app/utils/listNodeApi';

type ListNode = {
  id: number;
  name: string;
  type: string;
  isChecked: boolean;
  position: number;
  children?: ListNode[];
  error?: string;
};

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id?.toString() ?? '';
  const [list, setList] = useState<ListNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editListName, setEditListName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    if (!id) return;

    const fetchList = async () => {
      try {
        const listResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/listnodes/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!listResponse.ok) {
          throw new Error('Nem sikerült betölteni a listát');
        }

        const listData = await listResponse.json();

        // Fetch children separately
        try {
          const childrenData = await fetchChildren(Number(id));
          // Sort children by position
          childrenData.sort((a: ListNode, b: ListNode) => a.position - b.position);
          listData.children = childrenData;
        } catch (err) {
          console.error('Hiba a gyerekek betöltésekor:', err);
        }

        setList(listData);
        setEditListName(listData.name || '');
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchList();
  }, [id, router]);

  if (loading) {
    return (
      <main className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <LoadingSpinner />
          <p className="mt-4 text-gray-600">Lista tartalmának betöltése...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded p-6">
          <h2 className="text-red-800 font-semibold text-lg mb-2">Hiba történt</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            ← Vissza a főoldalra
          </button>
        </div>
      </main>
    );
  }

  if (!list) {
    return (
      <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="text-center">
          <p className="text-gray-500">A lista nem található.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            ← Vissza a főoldalra
          </button>
        </div>
      </main>
    );
  }

  const handleItemAdded = (newItem: ListNode) => {
    setShowAddForm(false);

    // Optimistic update - add item immediately
    setList(prev => {
      if (!prev) return prev;
      const updatedChildren = [...(prev.children || []), { ...newItem, error: undefined }];
      return { ...prev, children: updatedChildren };
    });

    // Validate by refreshing children
    fetchChildren(Number(id))
      .then(children => {
        // Sort children by position
        children.sort((a: ListNode, b: ListNode) => a.position - b.position);
        setList(prev => prev ? { ...prev, children } : null);
      })
      .catch(err => {
        // Mark the item with error if refresh fails
        console.error('Hiba az elemek frissítésekor:', err);
        setList(prev => {
          if (!prev?.children) return prev;
          const updated = prev.children.map(item =>
            item.id === newItem.id ? { ...item, error: 'Nem sikerült menteni' } : item
          );
          return { ...prev, children: updated };
        });
      });
  };

  const handleToggleItem = async (itemId: number) => {
    const item = list?.children?.find(i => i.id === itemId);
    if (!item) return;

    // Optimistic update - toggle immediately
    setList(prev => {
      if (!prev?.children) return prev;
      const updated = prev.children.map(i =>
        i.id === itemId ? { ...i, isChecked: !i.isChecked } : i
      );
      return { ...prev, children: updated };
    });

    try {
      await toggleListNode(itemId, item.isChecked);
    } catch (err) {
      console.error('Hiba az elem frissítésekor:', err);
      // Revert on error and show error message
      setList(prev => {
        if (!prev?.children) return prev;
        const updated = prev.children.map(i =>
          i.id === itemId ? { ...i, isChecked: !i.isChecked, error: 'Nem sikerült frissíteni' } : i
        );
        return { ...prev, children: updated };
      });
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    // Optimistic update - remove immediately
    setList(prev => {
      if (!prev?.children) return prev;
      const updated = prev.children.filter(item => item.id !== itemId);
      return { ...prev, children: updated };
    });

    try {
      await deleteListNode(itemId);
    } catch (err) {
      console.error('Hiba az elem törlésekor:', err);
      // Refresh children on error to restore the item
      try {
        const children = await fetchChildren(Number(id));
        // Mark restored items with error message
        const childrenWithErrors = children.map((child: ListNode) => ({
          ...child,
          error: 'Nem sikerült törölni'
        }));
        setList(prev => prev ? { ...prev, children: childrenWithErrors } : null);
      } catch (fetchErr) {
        console.error('Hiba a gyerekek újratöltésekor:', fetchErr);
      }
    }
  };

  const handlePositionChange = async (itemId: number, newPosition: number) => {
    // Get the current item and the item at the new position
    const currentItem = list?.children?.find(i => i.id === itemId);
    const itemAtNewPosition = list?.children?.[newPosition];
    if (!currentItem || !itemAtNewPosition) return;

    const currentIndex = list?.children?.findIndex(i => i.id === itemId) ?? -1;
    if (currentIndex === -1) return;

    // Optimistic update - swap items immediately
    setList(prev => {
      if (!prev?.children) return prev;
      const updated = [...prev.children];

      // Swap items
      [updated[currentIndex], updated[newPosition]] = [updated[newPosition], updated[currentIndex]];

      // Update positions
      return {
        ...prev,
        children: updated.map((item, idx) => ({
          ...item,
          position: idx
        }))
      };
    });

    try {
      // Update both items' positions
      await updateListNode(itemId, currentItem.name, newPosition);
      await updateListNode(itemAtNewPosition.id, itemAtNewPosition.name, currentIndex);
    } catch (err) {
      console.error('Hiba a pozícióváltáskor:', err);
      // Refresh children on error
      try {
        const children = await fetchChildren(Number(id));
        // Sort children by position
        children.sort((a: ListNode, b: ListNode) => a.position - b.position);
        setList(prev => prev ? { ...prev, children } : null);
      } catch (fetchErr) {
        console.error('Hiba a gyerekek újratöltésekor:', fetchErr);
      }
    }
  };

  const handleSaveListName = async () => {
    if (!editListName.trim() || !list) {
      setEditListName(list?.name || '');
      setIsEditingName(false);
      return;
    }

    // Optimistic update - save old value for rollback
    const oldName = list.name;
    setList(prev => prev ? { ...prev, name: editListName } : null);
    setIsEditingName(false);

    try {
      await updateListNode(Number(id), editListName);
    } catch (err) {
      console.error('Hiba a mentéskor:', err);
      alert('Nem sikerült frissíteni a lista nevét');
      // Revert on error
      setList(prev => prev ? { ...prev, name: oldName } : null);
      setEditListName(oldName);
    }
  };

  const handleCancelEditListName = () => {
    setEditListName(list?.name || '');
    setIsEditingName(false);
  };

  return (
    <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push('/')}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4 cursor-pointer"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Vissza
        </button>
      </div>

      <div className="bg-white rounded shadow-xl p-8">
        <div className="flex items-center justify-between mb-8">
          {isEditingName ? (
            <input
              type="text"
              value={editListName}
              onChange={(e) => setEditListName(e.target.value)}
              className="text-3xl font-bold text-gray-900 border border-blue-500 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 mr-4"
              autoFocus
              onBlur={handleSaveListName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveListName();
                if (e.key === 'Escape') handleCancelEditListName();
              }}
            />
          ) : (
            <h1
              onDoubleClick={() => setIsEditingName(true)}
              className="text-3xl font-bold text-gray-900 cursor-text hover:text-blue-600"
            >
              {list.name}
            </h1>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition duration-200 cursor-pointer"
          >
            + Új elem
          </button>
        </div>

        <div className="space-y-4">
          <AddItemForm
            parentId={id}
            isOpen={showAddForm}
            onClose={() => setShowAddForm(false)}
            onItemAdded={handleItemAdded}
          />
          {list.children && (
            <ListNodeList
              items={list.children}
              onToggle={handleToggleItem}
              onDelete={handleDeleteItem}
              onPositionChange={handlePositionChange}
            />
          )}
        </div>
      </div>
    </main>
  );
}
