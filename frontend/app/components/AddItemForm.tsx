'use client';

import { useState } from 'react';

type AddItemFormProps = {
  parentId: string;
  onItemAdded: (newItem: any) => void;
  isOpen: boolean;
  onClose: () => void;
};

export default function AddItemForm(props: AddItemFormProps) {
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState<'item' | 'sublist'>('item');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !props.parentId) return;

    setIsSubmitting(true);
    const token = localStorage.getItem('token');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/listnodes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: itemName,
          type: itemType,
          parentId: parseInt(props.parentId),
        }),
      });

      if (!response.ok) {
        throw new Error('Nem sikerült hozzáadni az elemet');
      }

      const newItem = await response.json();
      setItemName('');
      setItemType('item');
      props.onClose();

      // Pass the new item to parent for optimistic update
      props.onItemAdded(newItem);
    } catch (err) {
      console.error('Hiba az elem hozzáadásakor:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!props.isOpen) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <input
          type="text"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="Az elem neve"
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          autoFocus
          disabled={isSubmitting}
          required
        />
        <select
          value={itemType}
          onChange={(e) => setItemType(e.target.value as 'item' | 'sublist')}
          className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          disabled={isSubmitting}
        >
          <option value="item">Elem</option>
          <option value="sublist">Allista</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => {
            props.onClose();
            setItemName('');
            setItemType('item');
          }}
          className="px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition cursor-pointer disabled:cursor-not-allowed"
          disabled={isSubmitting}
        >
          Mégse
        </button>
        <button
          type="submit"
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          disabled={isSubmitting || !itemName.trim()}
        >
          {isSubmitting ? 'Hozzáadás...' : 'Hozzáadás'}
        </button>
      </div>
    </form>
  );
}
