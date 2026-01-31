'use client';

import { useEffect, useState } from "react";
import { fetchChildren, toggleListNode, deleteListNode, updateListNode } from "../utils/listNodeApi";
import { ListNodeType } from "./ListNode";
import ListNodeList from "./ListNodeList";
import EditableInput from "./EditableInput";

type SublistProps = {
  id: number;
  isEditing: boolean;
  displayName: string;
  editName: string;
  setIsEditing: (isEditing: boolean) => void;
  setEditName: (name: string) => void;
  handleSaveEdit: () => void;
  handleCancelEdit: () => void;
  refreshTrigger?: number;
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
          // Handle empty data (newly created sublist)
          const validData = Array.isArray(data) ? data : [];
          const sorted = [...validData].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
          setChildren(sorted);
          setChildrenLoaded(true);
          setLoading(false);
          console.log(`Sublist ${props.id} loaded ${sorted.length} children`);
        })
        .catch(err => {
          console.error('Hiba az elem betöltésekor:', err);
          // Set empty array for newly created sublists
          setChildren([]);
          setChildrenLoaded(true);
          setLoading(false);
        });
    }
  }, [isOpen, props.id, childrenLoaded]);

  // Refresh when refreshTrigger changes - implement optimistic updates
  useEffect(() => {
    if (props.refreshTrigger && isOpen && childrenLoaded) {
      console.log(`Sublist ${props.id}: Trigger changed, checking if refresh needed`);
      // Instead of always reloading, we implement optimistic updates
      // Only reload if we can't handle the change optimistically

      // For drag and drop moves, we should get the item data from global state
      // and update our local state accordingly, rather than reloading from DB

      // TODO: Implement proper optimistic updates here
      // For now, we'll skip the automatic reload and rely on optimistic updates
      // from the drag and drop system

      console.log(`Sublist ${props.id}: Skipping automatic reload, using optimistic updates`);
    }
  }, [props.refreshTrigger, props.id, isOpen, childrenLoaded]);

  // Handle optimistic updates for drag and drop
  const handleOptimisticMove = (draggedItemId: number, draggedParentId: number, targetParentId: number, movedItem: any) => {
    if (!childrenLoaded || !isOpen) return;

    // If item is being moved FROM this sublist
    if (draggedParentId === props.id) {
      console.log(`Sublist ${props.id}: Removing item ${draggedItemId} (moved to ${targetParentId})`);
      setChildren(prev => prev.filter(child => child.id !== draggedItemId));
    }

    // If item is being moved TO this sublist
    if (targetParentId === props.id && movedItem) {
      console.log(`Sublist ${props.id}: Adding item ${draggedItemId} (moved from ${draggedParentId})`);
      setChildren(prev => {
        // Check if item already exists (avoid duplicates)
        if (prev.some(child => child.id === draggedItemId)) {
          return prev;
        }
        return [...prev, movedItem];
      });
    }
  };

  // Handle reordering within this sublist
  const handleSublistReorder = async (draggedItemId: number, targetItemId: number) => {
    if (!childrenLoaded || !isOpen) return;

    const draggedIndex = children.findIndex(item => item.id === draggedItemId);
    const targetIndex = children.findIndex(item => item.id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    console.log(`Sublist ${props.id}: Reordering item ${draggedItemId} from position ${draggedIndex} to ${targetIndex}`);

    // Optimistic update - reorder immediately in UI
    const newChildren = [...children];
    const [draggedItem] = newChildren.splice(draggedIndex, 1);
    newChildren.splice(targetIndex, 0, draggedItem);

    // Update positions
    const updatedChildren = newChildren.map((child, index) => ({
      ...child,
      position: index
    }));

    setChildren(updatedChildren);

    try {
      // API calls to update positions in backend
      const positionUpdates = updatedChildren.map((child, index) =>
        updateListNode(child.id, child.name, index)
      );

      await Promise.all(positionUpdates);
      console.log(`Sublist ${props.id}: Reorder successful in backend`);
    } catch (err) {
      console.error(`Sublist ${props.id}: Backend reorder failed, reverting:`, err);
      // On error, revert to original order by reloading
      setChildrenLoaded(false);
      if (isOpen) {
        setLoading(true);
        fetchChildren(props.id)
          .then(data => {
            const validData = Array.isArray(data) ? data : [];
            const sorted = [...validData].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            setChildren(sorted);
            setChildrenLoaded(true);
            setLoading(false);
          })
          .catch(fetchErr => {
            console.error('Hiba az újratöltésekor:', fetchErr);
            setChildren([]);
            setChildrenLoaded(true);
            setLoading(false);
          });
      }
    }
  };

  // Expose the optimistic move handler globally
  // This is a bit of a hack, but allows the parent component to call this function
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!window.sublistOptimisticHandlers) {
        window.sublistOptimisticHandlers = {};
      }
      if (!window.sublistReorderHandlers) {
        window.sublistReorderHandlers = {};
      }

      window.sublistOptimisticHandlers[props.id] = handleOptimisticMove;
      window.sublistReorderHandlers[props.id] = handleSublistReorder;

      return () => {
        if (window.sublistOptimisticHandlers) {
          delete window.sublistOptimisticHandlers[props.id];
        }
        if (window.sublistReorderHandlers) {
          delete window.sublistReorderHandlers[props.id];
        }
      };
    }
  }, [props.id, childrenLoaded, isOpen]);

  const handleToggle = async (childId: number) => {
    // Find the child in our current state
    const child = children.find(c => c.id === childId);
    if (!child) return;

    // Optimistic update - toggle immediately in local state
    setChildren(prev => prev.map(c =>
      c.id === childId ? { ...c, isChecked: !c.isChecked } : c
    ));

    try {
      await toggleListNode(childId, child.isChecked);
    } catch (err) {
      console.error('Hiba a toggle-nél:', err);
      // Revert the optimistic update
      setChildren(prev => prev.map(c =>
        c.id === childId ? { ...c, isChecked: child.isChecked, error: 'Nem sikerült frissíteni' } : c
      ));
    }
  };

  const handleDelete = async (childId: number) => {
    // Optimistic update - remove immediately from local state
    setChildren(prev => prev.filter(child => child.id !== childId));

    try {
      await deleteListNode(childId);
      // Refresh children after successful deletion to get correct positions
      try {
        const refreshedChildren = await fetchChildren(props.id);
        const validData = Array.isArray(refreshedChildren) ? refreshedChildren : [];
        const sorted = [...validData].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        setChildren(sorted);
      } catch (fetchErr) {
        console.error('Hiba az újratöltésekor:', fetchErr);
      }
    } catch (err) {
      console.error('Hiba az elem törlésekor:', err);
      // Refresh children on error
      try {
        const refreshedChildren = await fetchChildren(props.id);
        const validData = Array.isArray(refreshedChildren) ? refreshedChildren : [];
        setChildren(validData.map((child: ListNodeType) => ({
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
        const validData = Array.isArray(refreshed) ? refreshed : [];
        const sorted = [...validData].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        setChildren(sorted);
      } catch (fetchErr) {
        console.error('Hiba a gyerekek újratöltésekor:', fetchErr);
      }
    }
  };

  const handleItemCreated = async () => {
    try {
      const refreshed = await fetchChildren(props.id);
      const validData = Array.isArray(refreshed) ? refreshed : [];
      const sorted = [...validData].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      setChildren(sorted);
    } catch (err) {
      console.error('Hiba a gyerekek újratöltésekor:', err);
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
          <EditableInput
            value={props.editName}
            onChange={props.setEditName}
            onSave={props.handleSaveEdit}
            onCancel={props.handleCancelEdit}
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
          <div className="mt-2">
            {loading ? (
              <div className="px-2 py-0.5 text-gray-500 italic">Betöltés...</div>
            ) : (
              <ListNodeList
                parentId={props.id}
                items={children}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onPositionChange={handlePositionChange}
                onItemCreated={handleItemCreated}
                refreshTrigger={props.refreshTrigger}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}
