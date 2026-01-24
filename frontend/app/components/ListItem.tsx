'use client';

import { useState, useEffect } from 'react';
import ListNodeList from './ListNodeList';
import { toggleListNode, deleteListNode, fetchChildren } from '@/app/utils/listNodeApi';

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
  onToggle?: (id: number) => void;
  onDelete?: (id: number) => void;
};

export default function ListItem({ id, name, type, isChecked, error, onToggle, onDelete }: ListItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<ListNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [childrenLoaded, setChildrenLoaded] = useState(false);

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

  return (
    <li className="py-1">
      <div className="flex items-center gap-3">
        {type === 'item' ? (
          <>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => onToggle?.(id)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
            <span className={isChecked ? 'line-through text-gray-400' : 'text-gray-800'}>
              {name}
            </span>
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
            <span
              onClick={handleToggleOpen}
              className="font-semibold text-gray-800 cursor-pointer hover:text-blue-600"
            >
              {name}
            </span>
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
            <div className="text-sm text-gray-500 italic">Betöltés...</div>
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
