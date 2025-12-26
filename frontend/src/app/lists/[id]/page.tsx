"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { ListDetail, Item, ListEntity } from '@/types/list';
import { apiFetch } from '@/lib/api';
import Spinner from '@/components/Spinner';
import { ToastProvider, useToast } from '@/contexts/ToastContext';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  type DraggableAttributes,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Generate a unique negative temp ID to avoid collisions and allow race-safe checks
const makeTempId = () => -Math.floor(Date.now() + Math.random() * 1e6);

const makeItemKey = (id: number) => `item-${id}`;
const makeSublistKey = (id: number) => `sublist-${id}`;
const makeListContainerKey = (listId: number) => `list-${listId}`;

const parseKey = (key: string): { type: 'item' | 'sublist'; id: number } | null => {
  if (key.startsWith('item-')) {
    return { type: 'item', id: Number(key.replace('item-', '')) };
  }
  if (key.startsWith('sublist-')) {
    return { type: 'sublist', id: Number(key.replace('sublist-', '')) };
  }
  return null;
};

const parseContainerKey = (key: string): { type: 'list'; id: number } | null => {
  if (key.startsWith('list-')) {
    return { type: 'list', id: Number(key.replace('list-', '')) };
  }
  return null;
};

// Shared list state helpers for drag-and-drop operations
type ListStateOps = {
  getItems: () => Item[];
  setItems: (next: Item[] | ((prev: Item[]) => Item[])) => void;
  getChildren: () => ListEntity[];
  setChildren: (next: ListEntity[] | ((prev: ListEntity[]) => ListEntity[])) => void;
};

type DragHandleProps = {
  attributes?: DraggableAttributes;
  listeners?: ReturnType<typeof useSortable>['listeners'];
};

interface SortableItemRowProps {
  item: Item;
  containerId: number;
  onStartEdit: (item: Item) => void;
  onToggle: (id: number, nextChecked: boolean) => void;
  onDelete: (id: number) => void;
  editingItemId: number | null;
  editingItemName: string;
  onEditNameChange: (next: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}

function SortableItemRow({
  item,
  containerId,
  onStartEdit,
  onToggle,
  onDelete,
  editingItemId,
  editingItemName,
  onEditNameChange,
  onSaveEdit,
  onCancelEdit,
}: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: makeItemKey(item.id), data: { containerId: makeListContainerKey(containerId) } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const isTemp = item.id < 0;
  const isCurrentEditing = editingItemId === item.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-2 flex items-center justify-between hover:bg-gray-700"
      data-container-id={makeListContainerKey(containerId)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span
          className="cursor-grab text-gray-500"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </span>
        {isTemp ? (
          <Spinner size={14} />
        ) : (
          <input
            type="checkbox"
            checked={item.isChecked}
            onChange={() => onToggle(item.id, !item.isChecked)}
            className="h-4 w-4"
          />
        )}
        {isCurrentEditing ? (
          <input
            type="text"
            value={editingItemName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSaveEdit();
              } else if (e.key === 'Escape') {
                onCancelEdit();
              }
            }}
            onBlur={onCancelEdit}
            autoFocus
            className="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-700 rounded bg-gray-900 text-gray-100"
          />
        ) : (
          <span
            className={`cursor-text ${item.isChecked ? 'line-through text-gray-400' : 'text-gray-100'}`}
            onClick={() => onStartEdit(item)}
            title="Click to edit"
          >
            {item.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isCurrentEditing ? (
          <>
            <button onMouseDown={(e) => e.preventDefault()} onClick={onSaveEdit} className="bg-gray-600 text-white px-3 py-1 rounded text-sm shrink-0">Save</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={onCancelEdit} className="bg-gray-500 text-white px-3 py-1 rounded text-sm shrink-0">Cancel</button>
          </>
        ) : null}
        <button
          onClick={() => onDelete(item.id)}
          disabled={isTemp}
          className="bg-red-600 text-white hover:bg-red-700 px-3 py-1 rounded transition text-sm disabled:bg-gray-600 flex items-center gap-2"
        >
          {isTemp && <Spinner size={12} />}
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}

interface SortableSublistRowProps {
  sublist: ListEntity;
  onDelete: (id: number) => void;
  containerId: number;
  registerListOps: (listId: number, ops: ListStateOps) => void;
  unregisterListOps: (listId: number) => void;
}

function SortableSublistRow({ sublist, onDelete, containerId, registerListOps, unregisterListOps }: SortableSublistRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: makeSublistKey(sublist.id), data: { containerId: makeListContainerKey(containerId) } });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const isTemp = sublist.id < 0;

  return (
    <div ref={setNodeRef} style={style}>
      <SublistItem
        sublist={sublist}
        onDelete={onDelete}
        dragHandleProps={{ attributes, listeners }}
        registerListOps={registerListOps}
        unregisterListOps={unregisterListOps}
      />
      {isTemp && (
        <div className="flex items-center gap-2 px-2 pb-2 text-xs text-gray-500"><Spinner size={12} /> Saving…</div>
      )}
    </div>
  );
}

interface SublistItemProps {
  sublist: ListEntity;
  onDelete: (id: number) => void;
  dragHandleProps?: DragHandleProps;
  registerListOps: (listId: number, ops: ListStateOps) => void;
  unregisterListOps: (listId: number) => void;
}

function SublistItem({ sublist, onDelete, dragHandleProps, registerListOps, unregisterListOps }: SublistItemProps) {
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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

  useEffect(() => {
    if (!sublistDetails) return;
    const ops: ListStateOps = {
      getItems: () => sublistDetails.items,
      setItems: (next) => setSublistDetails(prev => prev ? { ...prev, items: typeof next === 'function' ? (next as (p: Item[]) => Item[])(prev.items) : next } : prev),
      getChildren: () => sublistDetails.children || [],
      setChildren: (next) => setSublistDetails(prev => prev ? { ...prev, children: typeof next === 'function' ? (next as (p: ListEntity[]) => ListEntity[])(prev.children || []) : next } : prev),
    };
    registerListOps(sublist.id, ops);
    return () => unregisterListOps(sublist.id);
  }, [sublistDetails, sublist.id, registerListOps, unregisterListOps]);

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
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle}
                className="text-gray-400 hover:text-gray-200 transition"
              >
                {isExpanded ? '∨' : '>'}
              </button>
              {dragHandleProps ? (
                <span
                  className="cursor-grab text-gray-500"
                  {...dragHandleProps.attributes}
                  {...dragHandleProps.listeners}
                  title="Drag to reorder"
                >
                  ⋮⋮
                </span>
              ) : null}
            </div>
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
              <SortableContext
                items={sublistDetails.items.map((i) => makeItemKey(i.id))}
                strategy={verticalListSortingStrategy}
              >
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

                  {/* Items */}
                  {sublistDetails.items.map((item) => (
                    <SortableItemRow
                      key={`item-${item.id}`}
                      item={item}
                      containerId={sublist.id}
                      onStartEdit={startEditSubItem}
                      onToggle={handleToggleItem}
                      onDelete={handleDeleteItem}
                      editingItemId={editingItemId}
                      editingItemName={editingItemName}
                      onEditNameChange={setEditingItemName}
                      onSaveEdit={saveEditSubItem}
                      onCancelEdit={cancelEditSubItem}
                    />
                  ))}
              </SortableContext>

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

              {/* Nested Sublists */}
              <SortableContext
                items={(sublistDetails.children || []).map((c) => makeSublistKey(c.id))}
                strategy={verticalListSortingStrategy}
              >
                {sublistDetails.children && sublistDetails.children.map((child) => (
                  <SortableSublistRow
                    key={`sublist-${child.id}`}
                    sublist={child}
                    onDelete={handleDeleteSublist}
                    containerId={sublist.id}
                    registerListOps={registerListOps}
                    unregisterListOps={unregisterListOps}
                  />
                ))}
              </SortableContext>
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const listRegistry = useRef<Map<number, ListStateOps>>(new Map());

  const reorderItemsOnServer = useCallback(async (listId: number, orderedIds: number[]) => {
    if (orderedIds.some(id => id < 0)) return { ok: true }; // Skip while temp IDs present
    const res = await apiFetch(`http://localhost:8080/api/lists/${listId}/items/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIds: orderedIds }),
    });
    if (!res.ok) {
      let detail = '';
      try {
        const data = await res.json();
        detail = typeof data === 'object' ? (data.error || data.message || '') : '';
      } catch {}
      return { ok: false, detail, status: res.status } as const;
    }
    return { ok: true } as const;
  }, []);

  const reorderChildrenOnServer = useCallback(async (listId: number, orderedIds: number[]) => {
    if (orderedIds.some(id => id < 0)) return { ok: true }; // Skip while temp IDs present
    const res = await apiFetch(`http://localhost:8080/api/lists/${listId}/children/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listIds: orderedIds }),
    });
    if (!res.ok) {
      let detail = '';
      try {
        const data = await res.json();
        detail = typeof data === 'object' ? (data.error || data.message || '') : '';
      } catch {}
      return { ok: false, detail, status: res.status } as const;
    }
    return { ok: true } as const;
  }, []);

  const registerListOps = useCallback((listId: number, ops: ListStateOps) => {
    listRegistry.current.set(listId, ops);
  }, []);

  const unregisterListOps = useCallback((listId: number) => {
    listRegistry.current.delete(listId);
  }, []);

  const handleGlobalDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeMeta = parseKey(String(active.id));
    const overMeta = parseKey(String(over.id));
    const activeContainer = parseContainerKey(String(active.data.current?.containerId ?? ''));
    const overContainer = parseContainerKey(String(over.data.current?.containerId ?? ''));

    if (!activeMeta || !overMeta || activeMeta.type !== overMeta.type) return;

    const getOps = (listId?: number | null) => listId != null ? listRegistry.current.get(listId) : undefined;

    // Same-container reorder
    if (activeContainer && overContainer && activeContainer.id === overContainer.id) {
      const ops = getOps(activeContainer.id);
      if (!ops) return;
      if (activeMeta.type === 'item') {
        const items = ops.getItems();
        const from = items.findIndex(i => i.id === activeMeta.id);
        const to = items.findIndex(i => i.id === overMeta.id);
        if (from === -1 || to === -1) return;
        const previous = items;
        const reordered = arrayMove(items, from, to);
        ops.setItems(reordered);
        const result = await reorderItemsOnServer(activeContainer.id, reordered.map(i => i.id));
        if (!result.ok) {
          ops.setItems(previous);
          console.warn('Reorder items failed', { status: result.status, detail: result.detail });
          toast.error(result.detail || 'Could not save order.');
        }
      } else {
        const children = ops.getChildren();
        const from = children.findIndex(c => c.id === activeMeta.id);
        const to = children.findIndex(c => c.id === overMeta.id);
        if (from === -1 || to === -1) return;
        const previous = children;
        const reordered = arrayMove(children, from, to);
        ops.setChildren(reordered);
        const result = await reorderChildrenOnServer(activeContainer.id, reordered.map(c => c.id));
        if (!result.ok) {
          ops.setChildren(previous);
          console.warn('Reorder children failed', { status: result.status, detail: result.detail });
          toast.error(result.detail || 'Could not save order.');
        }
      }
      return;
    }

    // Cross-container move
    if (!activeContainer || !overContainer) return;

    if (activeMeta.type === 'item') {
      const sourceOps = getOps(activeContainer.id);
      const targetOps = getOps(overContainer.id);
      if (!sourceOps) return;

      let removed: Item | null = null;
      let sourceIndex = -1;
      sourceOps.setItems(prev => {
        sourceIndex = prev.findIndex(i => i.id === activeMeta.id);
        if (sourceIndex === -1) return prev;
        removed = prev[sourceIndex];
        const next = [...prev];
        next.splice(sourceIndex, 1);
        return next;
      });
      if (!removed) return;

      let targetIndex = -1;
      if (!targetOps) {
        // cannot drop into an unloaded list; revert
        sourceOps.setItems(prev => {
          const next = [...prev];
          const idx = sourceIndex >= 0 ? sourceIndex : next.length;
          next.splice(idx, 0, removed!);
          return next;
        });
        return;
      }

      let targetSnapshot: Item[] = targetOps.getItems();
      targetIndex = targetSnapshot.findIndex(i => i.id === overMeta.id);
      targetOps.setItems(prev => {
        const next = [...prev];
        const insertAt = targetIndex >= 0 ? targetIndex : next.length;
        next.splice(insertAt, 0, removed!);
        targetSnapshot = next;
        return next;
      });

      let sourceSnapshot: Item[] = sourceOps.getItems();
      sourceOps.setItems(prev => {
        const next = [...prev];
        return next;
      });

      try {
        await apiFetch(`http://localhost:8080/api/items/${activeMeta.id}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listId: overContainer.id }),
        });

        const targetResult = await reorderItemsOnServer(overContainer.id, targetSnapshot.map(i => i.id));
        const sourceResult = await reorderItemsOnServer(activeContainer.id, sourceOps.getItems().map(i => i.id));
        if (!targetResult.ok || !sourceResult.ok) {
          const detail = (targetResult.detail || sourceResult.detail || '').trim();
          console.warn('Reorder items failed after move', { targetResult, sourceResult });
          toast.error(detail || 'Could not finalize order.');
          router.refresh();
        }
      } catch (err) {
        console.error('Move item error:', err);
        // revert UI
        targetOps.setItems(prev => prev.filter(i => i.id !== removed!.id));
        sourceOps.setItems(prev => {
          const next = [...prev];
          const idx = sourceIndex >= 0 ? sourceIndex : next.length;
          next.splice(idx, 0, removed!);
          return next;
        });
        toast.error('Could not move item.');
      }
      return;
    }

    if (activeMeta.type === 'sublist') {
      const sourceOps = getOps(activeContainer.id);
      const targetOps = getOps(overContainer.id);
      if (!sourceOps) return;

      let removed: ListEntity | null = null;
      let sourceIndex = -1;
      sourceOps.setChildren(prev => {
        sourceIndex = prev.findIndex(c => c.id === activeMeta.id);
        if (sourceIndex === -1) return prev;
        removed = prev[sourceIndex];
        const next = [...prev];
        next.splice(sourceIndex, 1);
        return next;
      });
      if (!removed) return;

      let targetIndex = -1;
      if (!targetOps) {
        sourceOps.setChildren(prev => {
          const next = [...prev];
          const idx = sourceIndex >= 0 ? sourceIndex : next.length;
          next.splice(idx, 0, removed!);
          return next;
        });
        return;
      }

      let targetSnapshot: ListEntity[] = targetOps.getChildren();
      targetIndex = targetSnapshot.findIndex(c => c.id === overMeta.id);
      targetOps.setChildren(prev => {
        const next = [...prev];
        const insertAt = targetIndex >= 0 ? targetIndex : next.length;
        next.splice(insertAt, 0, removed!);
        targetSnapshot = next;
        return next;
      });

      sourceOps.setChildren(prev => {
        const next = [...prev];
        return next;
      });

      try {
        await apiFetch(`http://localhost:8080/api/lists/${activeMeta.id}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: overContainer.id }),
        });

        const targetResult = await reorderChildrenOnServer(overContainer.id, targetSnapshot.map(c => c.id));
        const sourceResult = await reorderChildrenOnServer(activeContainer.id, sourceOps.getChildren().map(c => c.id));
        if (!targetResult.ok || !sourceResult.ok) {
          const detail = (targetResult.detail || sourceResult.detail || '').trim();
          console.warn('Reorder children failed after move', { targetResult, sourceResult });
          toast.error(detail || 'Could not finalize order.');
          router.refresh();
        }
      } catch (err) {
        console.error('Move sublist error:', err);
        targetOps.setChildren(prev => prev.filter(c => c.id !== removed!.id));
        sourceOps.setChildren(prev => {
          const next = [...prev];
          const idx = sourceIndex >= 0 ? sourceIndex : next.length;
          next.splice(idx, 0, removed!);
          return next;
        });
        toast.error('Could not move sublist.');
      }
    }
  }, []);
  const router = useRouter();
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const listId = params.id as string;
  const listIdNum = Number(listId);
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
    if (!list) return;
    const ops: ListStateOps = {
      getItems: () => list.items,
      setItems: (next) => setList(prev => prev ? { ...prev, items: typeof next === 'function' ? (next as (p: Item[]) => Item[])(prev.items) : next } : prev),
      getChildren: () => list.children || [],
      setChildren: (next) => setList(prev => prev ? { ...prev, children: typeof next === 'function' ? (next as (p: ListEntity[]) => ListEntity[])(prev.children || []) : next } : prev),
    };
    registerListOps(list.id, ops);
    return () => unregisterListOps(list.id);
  }, [list, registerListOps, unregisterListOps]);

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

  const handleMainDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeMeta = parseKey(String(active.id));
    const overMeta = parseKey(String(over.id));
    const activeContainerMeta = parseContainerKey(String(active.data.current?.containerId ?? ''));
    const overContainerMeta = parseContainerKey(String(over.data.current?.containerId ?? ''));

    if (!activeMeta || !overMeta || activeMeta.type !== overMeta.type) return;

    // Same-container reorder
    if (activeContainerMeta && overContainerMeta && activeContainerMeta.id === overContainerMeta.id) {
      setList(prev => {
        if (!prev) return prev;
        if (activeMeta.type === 'item') {
          const oldIndex = prev.items.findIndex(i => i.id === activeMeta.id);
          const newIndex = prev.items.findIndex(i => i.id === overMeta.id);
          if (oldIndex === -1 || newIndex === -1) return prev;
          return { ...prev, items: arrayMove(prev.items, oldIndex, newIndex) };
        }
        if (activeMeta.type === 'sublist' && prev.children) {
          const oldIndex = prev.children.findIndex(c => c.id === activeMeta.id);
          const newIndex = prev.children.findIndex(c => c.id === overMeta.id);
          if (oldIndex === -1 || newIndex === -1) return prev;
          return { ...prev, children: arrayMove(prev.children, oldIndex, newIndex) };
        }
        return prev;
      });
      return;
    }

    // Cross-container moves
    if (!activeContainerMeta || !overContainerMeta) return;

    if (activeMeta.type === 'item') {
      const sourceListId = activeContainerMeta.id;
      const targetListId = overContainerMeta.id;
      if (sourceListId === targetListId) return;
      if (sourceListId !== listIdNum) return; // only handle moves from this list here

      let movedItem: Item | null = null;
      setList(prev => {
        if (!prev) return prev;
        const match = prev.items.find(i => i.id === activeMeta.id);
        if (!match) return prev;
        movedItem = match;
        return { ...prev, items: prev.items.filter(i => i.id !== activeMeta.id) };
      });

      const revert = () => {
        if (!movedItem) return;
        setList(prev => prev ? { ...prev, items: [...prev.items, movedItem!] } : prev);
      };

      try {
        await apiFetch(`http://localhost:8080/api/items/${activeMeta.id}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listId: targetListId }),
        });
      } catch (err) {
        console.error('Move item error:', err);
        revert();
        toast.error('Could not move item.');
      }
      return;
    }

    if (activeMeta.type === 'sublist') {
      const sourceParentId = activeContainerMeta.id;
      const targetParentId = overContainerMeta.id;
      if (sourceParentId === targetParentId) return;
      if (sourceParentId !== listIdNum) return;

      let movedSublist: ListEntity | null = null;
      setList(prev => {
        if (!prev || !prev.children) return prev;
        const match = prev.children.find(c => c.id === activeMeta.id);
        if (!match) return prev;
        movedSublist = match;
        return { ...prev, children: prev.children.filter(c => c.id !== activeMeta.id) };
      });

      const revert = () => {
        if (!movedSublist) return;
        setList(prev => prev ? { ...prev, children: [...(prev.children || []), movedSublist!] } : prev);
      };

      try {
        await apiFetch(`http://localhost:8080/api/lists/${activeMeta.id}/move`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parentId: targetParentId }),
        });
      } catch (err) {
        console.error('Move sublist error:', err);
        revert();
        toast.error('Could not move sublist.');
      }
    }
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleGlobalDragEnd}
            >
              <SortableContext
                items={list.items.map((i) => makeItemKey(i.id))}
                strategy={verticalListSortingStrategy}
              >
                {list.items.map((item) => (
                  <SortableItemRow
                    key={`item-${item.id}`}
                    item={item}
                    containerId={listIdNum}
                    onStartEdit={startEditMainItem}
                    onToggle={handleToggleItem}
                    onDelete={handleDeleteItem}
                    editingItemId={editingItemId}
                    editingItemName={editingItemName}
                    onEditNameChange={setEditingItemName}
                    onSaveEdit={saveEditMainItem}
                    onCancelEdit={cancelEditMainItem}
                  />
                ))}
              </SortableContext>

              <SortableContext
                items={(list.children || []).map((c) => makeSublistKey(c.id))}
                strategy={verticalListSortingStrategy}
              >
                {list.children && list.children.map((child) => (
                  <SortableSublistRow
                    key={`sublist-${child.id}`}
                    sublist={child}
                    onDelete={handleDeleteSublist}
                    containerId={listIdNum}
                    registerListOps={registerListOps}
                    unregisterListOps={unregisterListOps}
                  />
                ))}
              </SortableContext>
            </DndContext>
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
