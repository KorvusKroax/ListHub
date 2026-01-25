'use client';

import { useEffect, useState } from "react";
import { fetchChildren, toggleListNode, deleteListNode, updateListNode } from "../utils/listNodeApi";
import { ListNodeType } from "./ListNode";
import ListNodeList from "./ListNodeList";

type SublistProps = {
  id: number;
  isEditing: boolean;
  displayName: string;
  editName: string;
  setIsEditing: (isEditing: boolean) => void;
  setEditName: (name: string) => void;
  handleSaveEdit: () => void;
  handleCancelEdit: () => void;
};

export default function Sublist(props: SublistProps) {

  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<ListNodeType[]>([]);
  const [loading, setLoading] = useState(false);
  const [childrenLoaded, setChildrenLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !childrenLoaded) {
      setLoading(true);
      fetchChildren(props.id)
        .then(data => {
          const sorted = [...data].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          setChildren(sorted);
          setChildrenLoaded(true);
          setLoading(false);
        })
        .catch(err => {
          console.error('Hiba az elem betöltésekor:', err);
          setLoading(false);
        });
    }
  }, [isOpen, props.id, childrenLoaded]);





  const handleToggle = async (childId: number) => {
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

  const handleDelete = async (childId: number) => {
    // Optimistic update - remove immediately from local state
    setChildren(prev => prev.filter(child => child.id !== childId));

    try {
      await deleteListNode(childId);
    } catch (err) {
      console.error('Hiba az elem törlésekor:', err);
      // Refresh children on error
      try {
        const refreshedChildren = await fetchChildren(props.id);
        setChildren(refreshedChildren.map((child: ListNodeType) => ({
          ...child,
          error: 'Nem sikerült törölni'
        })));
      } catch (fetchErr) {
        console.error('Hiba az újratöltésekor:', fetchErr);
      }
    }
  };

  const handlePositionChange = async (childId: number, newPosition: number) => {
    const currentIndex = children.findIndex(c => c.id === childId);
    if (currentIndex === -1 || currentIndex === newPosition) return;

    // Optimistic reorder in local state
    setChildren(prev => {
      const idx = prev.findIndex(c => c.id === childId);
      if (idx === -1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(idx, 1);
      updated.splice(newPosition, 0, moved);
      return updated.map((child, position) => ({ ...child, position }));
    });

    try {
      const reordered = [...children];
      const [movedChild] = reordered.splice(currentIndex, 1);
      reordered.splice(newPosition, 0, movedChild);

      const updates = [] as Promise<void>[];
      for (let i = Math.min(currentIndex, newPosition); i <= Math.max(currentIndex, newPosition); i++) {
        const child = reordered[i];
        updates.push(updateListNode(child.id, child.name, i));
      }

      await Promise.all(updates);
    } catch (err) {
      console.error('Hiba a pozícióváltáskor:', err);
      try {
        const refreshed = await fetchChildren(props.id);
        const sorted = [...refreshed].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        setChildren(sorted);
      } catch (fetchErr) {
        console.error('Hiba a gyerekek újratöltésekor:', fetchErr);
      }
    }
  };





  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="self-start pt-1 focus:outline-none cursor-pointer"
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

      <div className="flex-1">
        {props.isEditing ? (
          <input
            type="text"
            value={props.editName}
            onChange={(e) => props.setEditName(e.target.value)}
            className="flex-1 px-2 py-1 border border-blue-500 rounded font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
            onBlur={props.handleSaveEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.handleSaveEdit();
              if (e.key === 'Escape') props.handleCancelEdit();
            }}
          />
        ) : (
          <span
            onClick={() => props.setIsEditing(true)}
            className="font-semibold text-gray-800 cursor-text hover:text-blue-600"
          >
            {props.displayName}
          </span>
        )}

        {isOpen && (
          <div className="-ml-10 mt-2">
            {loading ? (
              <div className="py-1 text-gray-500 italic">Betöltés...</div>
            ) : (
              <ListNodeList
                items={children}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onPositionChange={handlePositionChange}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
