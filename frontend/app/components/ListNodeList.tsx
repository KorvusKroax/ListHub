'use client';

import { useState } from 'react';
import { ListNodeType, ListNode } from './ListNode';

type ListNodeListProps = {
  parentId: number;
  items: ListNodeType[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onPositionChange?: (itemId: number, newPosition: number, newParentId?: number) => void;
  onItemCreated?: () => Promise<void>;
  refreshTrigger?: number;
};

export default function ListNodeList(props: ListNodeListProps) {
  const [newItems, setNewItems] = useState<ListNodeType[]>([]);

  const addNewEmptyItem = (type: 'item' | 'sublist') => {
    const newItem: ListNodeType = {
      id: Date.now(), // Temporary ID until saved to backend
      name: '',
      type: type,
      isChecked: false,
      position: props.items.length + newItems.length,
      parentId: props.parentId,
    };
    setNewItems([...newItems, newItem]);
  };

  const handleNewItemCreated = async (tempId: number) => {
    // First refresh the list to get the new item from server
    if (props.onItemCreated) {
      await props.onItemCreated();
    }
    // Then remove the temporary item
    setNewItems(newItems.filter(item => item.id !== tempId));
  };

  const handleDeleteNewItem = (tempId: number) => {
    setNewItems(newItems.filter(item => item.id !== tempId));
  };

  return (
    <ul>
      {props.items.length ? (props.items.map((item) => (
        <ListNode
          key={item.id}
          id={item.id}
          name={item.name}
          type={item.type as 'item' | 'sublist'}
          isChecked={item.isChecked}
          error={item.error}
          parentId={props.parentId}
          onToggle={props.onToggle}
          onDelete={props.onDelete}
          refreshTrigger={props.refreshTrigger}
        />
      ))) : (
        <li className="px-2 py-0.5 text-gray-500 italic">
          Nincs még elem ebben a listában.
        </li>
      )}
      {newItems.map((item) => (
        <ListNode
          key={item.id}
          id={item.id}
          name={item.name}
          type={item.type as 'item' | 'sublist'}
          isChecked={item.isChecked}
          error={item.error}
          parentId={props.parentId}
          onToggle={props.onToggle}
          onDelete={handleDeleteNewItem}
          onCreated={handleNewItemCreated}
          isEditing={true}
          isNew={true}
        />
      ))}
      <li className="px-2 py-0.5 flex space-x-2">
        <button
          onClick={() => addNewEmptyItem('item')}
          className="px-3 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition duration-200 cursor-pointer"
        >
          + Új elem
        </button>
        <button
          onClick={() => addNewEmptyItem('sublist')}
          className="px-3 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded transition duration-200 cursor-pointer"
        >
          + Új lista
        </button>
      </li>
    </ul>
  );
}
