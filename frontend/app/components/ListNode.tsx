'use client';

import { useState, useEffect } from 'react';
import { updateListNode, createListNode } from '@/app/utils/listNodeApi';
import Item from './Item';
import Sublist from './Sublist';

export type ListNodeType = {
  id: number;
  name: string;
  type: string;
  isChecked: boolean;
  position: number;
  parentId: number;
  children?: ListNodeType[];
  error?: string;
};

type ListNodeProps = {
  id: number;
  name: string;
  type: 'item' | 'sublist';
  isChecked: boolean;
  error?: string;
  isEditing?: boolean;
  isNew?: boolean;
  parentId?: number;
  onToggle?: (id: number) => void;
  onDelete?: (id: number) => void;
  onCreated?: (tempId: number) => Promise<void>;
};

export function ListNode(props: ListNodeProps) {
  const [isEditing, setIsEditing] = useState(props.isEditing || false);
  const [editName, setEditName] = useState(props.name);
  const [displayName, setDisplayName] = useState(props.name);

  useEffect(() => {
    setDisplayName(props.name);
    setEditName(props.name);
  }, [props.name]);

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      // Empty name: remove the item (new or existing)
      props.onDelete?.(props.id);
      return;
    }

    // Optimistic update - save old value for rollback
    const oldName = displayName;
    setDisplayName(editName);
    setIsEditing(false);

    try {
      if (props.isNew && props.parentId !== undefined) {
        // Create new item
        await createListNode(props.parentId, editName, props.type);
        await props.onCreated?.(props.id);
      } else {
        // Update existing item
        await updateListNode(props.id, editName);
      }
    } catch (err) {
      console.error('Hiba a mentéskor:', err);
      alert(props.isNew ? 'Nem sikerült létrehozni' : 'Nem sikerült frissíteni a nevet');
      // Revert on error
      setDisplayName(oldName);
      setEditName(oldName);
    }
  };

  const handleCancelEdit = () => {
    if (props.isNew) {
      // If it's a new item and user cancels, delete it
      props.onDelete?.(props.id);
    } else {
      setEditName(displayName);
      setIsEditing(false);
    }
  };

  return (
    <li className="py-1">
      <div className="flex items-center gap-3">
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
