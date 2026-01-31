'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DndContext, DragEndEvent } from '@dnd-kit/core';
import ListNodeList from '@/app/components/ListNodeList';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { toggleListNode, deleteListNode, fetchChildren, updateListNode, moveListNode } from '@/app/utils/listNodeApi';
import { ListNodeType } from '@/app/components/ListNode';

// TypeScript declaration for global window object
declare global {
  interface Window {
    sublistOptimisticHandlers?: {
      [key: number]: (draggedItemId: number, draggedParentId: number, targetParentId: number, movedItem: any) => void;
    };
    sublistReorderHandlers?: {
      [key: number]: (draggedItemId: number, targetItemId: number) => void;
    };
  }
}

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id?.toString() ?? '';
  const [list, setList] = useState<ListNodeType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editListName, setEditListName] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
          childrenData.sort((a: ListNodeType, b: ListNodeType) => a.position - b.position);
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

  const handlePositionChange = async (itemId: number, newPosition: number) => {
    if (!list?.children) return;

    const currentIndex = list.children.findIndex(i => i.id === itemId);
    if (currentIndex === -1 || currentIndex === newPosition) return;

    // Optimistic update - insert item at new position
    setList(prev => {
      if (!prev?.children) return prev;
      const updated = [...prev.children];

      // Remove item from current position
      const [movedItem] = updated.splice(currentIndex, 1);

      // Insert at new position
      updated.splice(newPosition, 0, movedItem);

      // Update all positions
      const reordered = updated.map((item, idx) => ({
        ...item,
        position: idx
      }));

      return {
        ...prev,
        children: reordered
      };
    });

    try {
      // Update positions for all affected items
      const updates = [];
      const reorderedItems = [...list.children];
      const [movedItem] = reorderedItems.splice(currentIndex, 1);
      reorderedItems.splice(newPosition, 0, movedItem);

      // Update positions in backend for all affected items
      for (let i = Math.min(currentIndex, newPosition); i <= Math.max(currentIndex, newPosition); i++) {
        const item = reorderedItems[i];
        updates.push(updateListNode(item.id, item.name, i));
      }

      await Promise.all(updates);
    } catch (err) {
      console.error('Hiba a pozícióváltáskor:', err);
      // Refresh children on error
      try {
        const children = await fetchChildren(Number(id));
        // Sort children by position
        children.sort((a: ListNodeType, b: ListNodeType) => a.position - b.position);
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

  const handleDeleteItem = async (itemId: number) => {
    // Optimistic update - remove immediately
    setList(prev => {
      if (!prev?.children) return prev;
      const updated = prev.children.filter(item => item.id !== itemId);
      return { ...prev, children: updated };
    });

    try {
      await deleteListNode(itemId);
      // Refresh children after successful deletion to get correct positions
      try {
        const children = await fetchChildren(Number(id));
        children.sort((a: ListNodeType, b: ListNodeType) => a.position - b.position);
        setList(prev => prev ? { ...prev, children } : null);
      } catch (fetchErr) {
        console.error('Hiba a gyerekek újratöltésekor:', fetchErr);
      }
    } catch (err) {
      console.error('Hiba az elem törlésekor:', err);
      // Refresh children on error to restore the item
      try {
        const children = await fetchChildren(Number(id));
        // Mark restored items with error message
        const childrenWithErrors = children.map((child: ListNodeType) => ({
          ...child,
          error: 'Nem sikerült törölni'
        }));
        setList(prev => prev ? { ...prev, children: childrenWithErrors } : null);
      } catch (fetchErr) {
        console.error('Hiba a gyerekek újratöltésekor:', fetchErr);
      }
    }
  };

  const handleItemCreated = async () => {
    try {
      const children = await fetchChildren(Number(id));
      // Sort children by position
      children.sort((a: ListNodeType, b: ListNodeType) => a.position - b.position);
      setList(prev => prev ? { ...prev, children } : null);
    } catch (err) {
      console.error('Hiba a gyerekek újratöltésekor:', err);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      console.log('Drag cancelled - no target');
      return;
    }

    const draggedItemId = Number(active.id);
    const targetItemId = Number(over.id);

    // Get data from drag elements
    const draggedData = active.data.current;
    const targetData = over.data.current;

    // Same item - do nothing
    if (draggedItemId === targetItemId) {
      return;
    }

    const draggedParentId = draggedData?.parentId;
    const targetParentId = targetData?.parentId;
    const isCrossContainer = draggedParentId !== targetParentId;

    console.log('Hierarchikus Drag & Drop:', {
      draggedItem: {
        id: draggedItemId,
        parentId: draggedParentId,
        name: draggedData?.name,
        type: draggedData?.type
      },
      targetItem: {
        id: targetItemId,
        parentId: targetParentId,
        name: targetData?.name,
        type: targetData?.type
      },
      crossContainer: isCrossContainer,
      action: isCrossContainer ? 'MOVE_TO_DIFFERENT_LIST' : 'REORDER_IN_SAME_LIST'
    });

    // Only implement cross-container moves for now
    if (isCrossContainer && targetParentId !== undefined) {
      try {
        console.log(`Moving item ${draggedItemId} from parent ${draggedParentId} to parent ${targetParentId}`);

        // OPTIMISTIC UPDATE - Update UI immediately
        const movedItem = {
          id: draggedItemId,
          name: draggedData?.name || 'Unknown',
          type: draggedData?.type || 'item',
          isChecked: draggedData?.isChecked || false,
          position: 0, // Will be updated by backend
          parentId: targetParentId,
        };

        // If moving FROM mainlist - remove from mainlist children
        if (draggedParentId === Number(id)) {
          setList(prev => {
            if (!prev?.children) return prev;
            const filtered = prev.children.filter(child => child.id !== draggedItemId);
            return { ...prev, children: filtered };
          });
        }

        // If moving TO mainlist - add to mainlist children
        if (targetParentId === Number(id)) {
          setList(prev => {
            if (!prev) return prev;
            const newChildren = [...(prev.children || []), movedItem];
            return { ...prev, children: newChildren };
          });
        }

        // Call optimistic handlers for affected sublists instead of refresh trigger
        const mainListId = Number(id);
        if (draggedParentId !== mainListId || targetParentId !== mainListId) {
          console.log('Calling optimistic handlers for sublists');

          // Use the globally registered optimistic handlers
          if (typeof window !== 'undefined' && window.sublistOptimisticHandlers) {
            // Call handlers for all sublists that might be affected
            Object.values(window.sublistOptimisticHandlers).forEach(handler => {
              if (typeof handler === 'function') {
                handler(draggedItemId, draggedParentId, targetParentId, movedItem);
              }
            });
          }
        }
        // API call to move the item (in background)
        moveListNode(draggedItemId, targetParentId)
          .then(() => {
            console.log('Move successful in backend');
          })
          .catch(err => {
            console.error('Backend move failed, rolling back:', err);
            // Rollback optimistic update
            rollbackItemMove(draggedItemId, draggedParentId, targetParentId);
            alert('Nem sikerült átmozgatni az elemet');
          });

      } catch (err) {
        console.error('Error in optimistic update:', err);
      }
    } else if (!isCrossContainer) {
      console.log('Same-container reordering: implementing now');

      // Handle reordering within the same container
      const draggedParentId = draggedData?.parentId;

      if (draggedParentId === Number(id)) {
        // Reordering in mainlist
        console.log('Reordering in mainlist');
        handleMainListReorder(draggedItemId, targetItemId);
      } else {
        // Reordering in sublist - call the optimistic handler
        console.log(`Reordering in sublist ${draggedParentId}`);
        if (typeof window !== 'undefined' && window.sublistOptimisticHandlers) {
          const handler = window.sublistOptimisticHandlers[draggedParentId];
          if (typeof handler === 'function') {
            // For same-container reordering, we call a special reorder function
            if (window.sublistReorderHandlers && window.sublistReorderHandlers[draggedParentId]) {
              window.sublistReorderHandlers[draggedParentId](draggedItemId, targetItemId);
            }
          }
        }
      }
    }
  };

  // Handle reordering within mainlist
  const handleMainListReorder = async (draggedItemId: number, targetItemId: number) => {
    if (!list?.children) return;

    const children = [...list.children];
    const draggedIndex = children.findIndex(item => item.id === draggedItemId);
    const targetIndex = children.findIndex(item => item.id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    console.log(`Reordering in mainlist: moving item ${draggedItemId} from position ${draggedIndex} to ${targetIndex}`);

    // Optimistic update - reorder immediately in UI
    const [draggedItem] = children.splice(draggedIndex, 1);
    children.splice(targetIndex, 0, draggedItem);

    // Update positions
    const updatedChildren = children.map((child, index) => ({
      ...child,
      position: index
    }));

    setList(prev => prev ? { ...prev, children: updatedChildren } : prev);

    try {
      // API calls to update positions in backend
      const positionUpdates = updatedChildren.map((child, index) =>
        updateListNode(child.id, child.name, index)
      );

      await Promise.all(positionUpdates);
      console.log('Mainlist reorder successful in backend');
    } catch (err) {
      console.error('Backend reorder failed, refreshing:', err);
      // On error, refresh the list to get correct positions
      window.location.reload();
    }
  };

  // Event handler for item moved
  const handleItemMoved = (itemId: number, fromParentId: number, toParentId: number, movedItem: any) => {
    console.log(`Event: Item ${itemId} moved from ${fromParentId} to ${toParentId}`);
    // This will be passed to sublists via props
  };

  // Rollback function for failed moves
  const rollbackItemMove = (itemId: number, fromParentId: number, toParentId: number) => {
    console.log(`Rolling back move of item ${itemId}`);

    const mainListId = Number(id);

    // If was moved FROM mainlist, add it back
    if (fromParentId === mainListId) {
      console.log('Rolling back: Adding item back to mainlist');
      // We would need the original item data to add it back properly
      // For now, just trigger a full refresh
      window.location.reload();
    }

    // If was moved TO mainlist, remove from mainlist
    if (toParentId === mainListId) {
      setList(prev => {
        if (!prev?.children) return prev;
        const filtered = prev.children.filter(child => child.id !== itemId);
        return { ...prev, children: filtered };
      });
    }

    // Send rollback to optimistic handlers instead of refresh trigger
    if (fromParentId !== mainListId || toParentId !== mainListId) {
      console.log('Calling rollback on optimistic handlers');

      if (typeof window !== 'undefined' && window.sublistOptimisticHandlers) {
        // For rollback, we swap the from/to parameters to reverse the move
        Object.values(window.sublistOptimisticHandlers).forEach(handler => {
          if (typeof handler === 'function') {
            handler(itemId, toParentId, fromParentId, null); // null because we're removing
          }
        });
      }
    }
  };

  const handleShareList = () => {
    // For simplicity, just alert the share link
    const shareLink = `${window.location.origin}/lists/${id}`;
    alert(`Megosztási link: ${shareLink}`);
  };

  const handleDeleteList = () => {
    // For simplicity, just navigate back to main page
    router.push('/');
  };

  return (
    <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push('/')}
          className="text-gray-600 hover:text-blue-600 flex items-center gap-2 mb-4 cursor-pointer"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Vissza
        </button>
      </div>

      <div className="bg-gray-50 rounded shadow-xl p-8">
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

          <div className="flex space-x-4">
            <button
              onClick={handleShareList}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition duration-200 cursor-pointer"
            >
              Megosztás
            </button>
            <button
              onClick={handleDeleteList}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition duration-200 cursor-pointer"
            >
              Törlés
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {list.children && (
            <DndContext onDragEnd={handleDragEnd}>
              <ListNodeList
                parentId={Number(id)}
                items={list.children}
                onToggle={handleToggleItem}
                onDelete={handleDeleteItem}
                onPositionChange={handlePositionChange}
                onItemCreated={handleItemCreated}
                refreshTrigger={refreshTrigger}
              />
            </DndContext>
          )}

        </div>
      </div>
    </main>
  );
}
