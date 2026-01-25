'use client';

import { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { updateListNode } from '@/app/utils/listNodeApi';
import Item from './Item';
import Sublist from './Sublist';

export type ListNodeType = {
  id: number;
  name: string;
  type: string;
  isChecked: boolean;
  position?: number;
  parentId?: number;
  error?: string;
};

type ListNodeProps = {
  id: number;
  name: string;
  type: 'item' | 'sublist';
  isChecked: boolean;
  error?: string;
  onToggle?: (id: number) => void;
  onDelete?: (id: number) => void;
};

export function ListNode(props: ListNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(props.name);
  const [displayName, setDisplayName] = useState(props.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    setDisplayName(props.name);
    setEditName(props.name);
  }, [props.name]);

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
      await updateListNode(props.id, editName);
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
          className="self-start p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
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

        {props.type === 'item' ? (
          <Item
            id={props.id}
            isChecked={props.isChecked}
            isEditing={isEditing}
            displayName={displayName}
            editName={editName}
            setIsEditing={setIsEditing}
            setEditName={setEditName}
            handleSaveEdit={handleSaveEdit}
            handleCancelEdit={handleCancelEdit}
            onToggle={props.onToggle}
          />
        ) : (
          <Sublist
            id={props.id}
            isEditing={isEditing}
            displayName={displayName}
            editName={editName}
            setIsEditing={setIsEditing}
            setEditName={setEditName}
            handleSaveEdit={handleSaveEdit}
            handleCancelEdit={handleCancelEdit}
          />
        )}

        <button
          onClick={() => props.onDelete?.(props.id)}
          className="self-start pt-1 ml-auto text-gray-400 hover:text-red-600 transition cursor-pointer"
          title="Törlés"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

      </div>

      {props.error && (<div className="mt-1 text-sm text-red-600 font-medium">{props.error}</div>)}

    </li>
  );
}
