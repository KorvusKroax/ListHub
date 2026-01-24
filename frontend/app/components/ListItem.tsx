'use client';

import { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ListNodeList from './ListNodeList';
import { toggleListNode, deleteListNode, fetchChildren, updateListNode } from '@/app/utils/listNodeApi';

type ListNode = {
  id: number;
  name: string;
  type: string;
  isChecked: boolean;
  error?: string;
};

type ListItemProps = {
  id: number;
  name: string;
  type: 'item' | 'sublist';
  isChecked: boolean;
  error?: string;
  index?: number;
  totalItems?: number;
  onToggle?: (id: number) => void;
  onDelete?: (id: number) => void;
  onPositionChange?: (itemId: number, newPosition: number) => void;
};

export default function ListItem({ id, name, type, isChecked, error, index = 0, totalItems = 1, onToggle, onDelete, onPositionChange }: ListItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<ListNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [displayName, setDisplayName] = useState(name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    setDisplayName(name);
    setEditName(name);
  }, [name]);

  useEffect(() => {
    if (isOpen && type === 'sublist' && !childrenLoaded) {
      setLoading(true);
      fetchChildren(id)
        .then(data => {
          setChildren(data);
          setChildrenLoaded(true);
          setLoading(false);
        })
        .catch(err => {
          console.error('Hiba az elem betöltésekor:', err);
          setLoading(false);
        });
    }
  }, [isOpen, type, id, childrenLoaded]);

  const handleToggleOpen = () => {
    if (type === 'sublist') {
      setIsOpen(!isOpen);
    }
  };

  const handleChildToggle = async (childId: number) => {
    const child = children.find(c => c.id === childId);
    if (!child) return;

    // Optimistic update - toggle immediately in local state
    setChildren(prev => prev.map(c =>
      c.id === childId ? { ...c, isChecked: !c.isChecked } : c
    ));

    try {
      await toggleListNode(childId, child.isChecked);
    } catch (err) {
      console.error('Hiba az elem frissítésekor:', err);
      // Revert on error
      setChildren(prev => prev.map(c =>
        c.id === childId ? { ...c, isChecked: !c.isChecked, error: 'Nem sikerült frissíteni' } : c
      ));
    }
  };

  const handleChildDelete = async (childId: number) => {
    // Optimistic update - remove immediately from local state
    setChildren(prev => prev.filter(child => child.id !== childId));

    try {
      await deleteListNode(childId);
    } catch (err) {
      console.error('Hiba az elem törlésekor:', err);
      // Refresh children on error
      try {
        const refreshedChildren = await fetchChildren(id);
        setChildren(refreshedChildren.map((child: ListNode) => ({
          ...child,
          error: 'Nem sikerült törölni'
        })));
      } catch (fetchErr) {
        console.error('Hiba az újratöltésekor:', fetchErr);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      setEditName(displayName);
      setIsEditing(false);
      return;
    }

    // Optimistic update - save old value for rollback
    const oldName = displayName;
    setDisplayName(editName);
    setIsEditing(false);

    try {
      await updateListNode(id, editName);
    } catch (err) {
      console.error('Hiba a mentéskor:', err);
      alert('Nem sikerült frissíteni a nevet');
      // Revert on error
      setDisplayName(oldName);
      setEditName(oldName);
    }
  };

  const handleCancelEdit = () => {
    setEditName(displayName);
    setIsEditing(false);
  };

  return (
    <li ref={setNodeRef} style={style} className="py-1">
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 p-1"
          title="Húzd az elem mozgatásához"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="7" cy="6" r="1.5" />
            <circle cx="7" cy="12" r="1.5" />
            <circle cx="7" cy="18" r="1.5" />
            <circle cx="13" cy="6" r="1.5" />
            <circle cx="13" cy="12" r="1.5" />
            <circle cx="13" cy="18" r="1.5" />
          </svg>
        </button>
        {type === 'item' ? (
          <>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => onToggle?.(id)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-2 py-1 border border-blue-500 rounded text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
            ) : (
              <span
                onClick={() => setIsEditing(true)}
                className={`flex-1 cursor-text ${isChecked ? 'line-through text-gray-400' : 'text-gray-800 hover:text-blue-600'}`}
              >
                {displayName}
              </span>
            )}
          </>
        ) : (
          <>
            <button
              onClick={handleToggleOpen}
              className="focus:outline-none cursor-pointer"
            >
              <svg
                className={`w-4 h-4 text-blue-600 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {isEditing ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 px-2 py-1 border border-blue-500 rounded font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
                onBlur={handleSaveEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
            ) : (
              <span
                onClick={() => setIsEditing(true)}
                className="font-semibold text-gray-800 cursor-text hover:text-blue-600"
              >
                {displayName}
              </span>
            )}
          </>
        )}
        <button
          onClick={() => onDelete?.(id)}
          className="ml-auto text-gray-400 hover:text-red-600 transition cursor-pointer"
          title="Törlés"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {error && (
        <div className="mt-1 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}
      {isOpen && type === 'sublist' && (
        <div className="ml-6 mt-2">
          {loading ? (
            <div className="px-3 py-1 text-gray-500 italic">Betöltés...</div>
          ) : (
            <ListNodeList
              items={children}
              onToggle={handleChildToggle}
              onDelete={handleChildDelete}
              emptyMessage="Még nincs elem ebben a listában."
            />
          )}
        </div>
      )}
    </li>
  );
}
