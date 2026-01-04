'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AddItemForm from '@/app/components/AddItemForm';
import ListItem from '@/app/components/ListItem';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { toggleListNode, deleteListNode, fetchChildren } from '@/app/utils/listNodeApi';

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
          listData.children = childrenData;
        } catch (err) {
          console.error('Hiba a gyerekek betöltésekor:', err);
        }

        setList(listData);
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

  return (
    <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push('/')}
          className="text-gray-600 hover:text-gray-900 flex items-center gap-2 mb-4"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Vissza
        </button>
      </div>

      <div className="bg-white rounded shadow-xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{list.name}</h1>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition duration-200">
              Szerkesztés
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition duration-200"
            >
              + Új elem
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <AddItemForm
            parentId={id}
            isOpen={showAddForm}
            onClose={() => setShowAddForm(false)}
            onItemAdded={handleItemAdded}
          />
          {list.children && list.children.length > 0 ? (
            <ul className="space-y-2">
              {list.children.map((item) => (
                <ListItem
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  type={item.type as 'item' | 'sublist'}
                  isChecked={item.isChecked}
                  error={item.error}
                  onToggle={handleToggleItem}
                  onDelete={handleDeleteItem}
                />
              ))}
            </ul>
          ) : (
            <div className="text-center py-12 text-gray-500">
              Nincs még elem ebben a listában.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
