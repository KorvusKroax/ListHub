'use client';

import { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ListNodeType, ListNode } from './ListNode';

type ListNodeListProps = {
  parentId: number;
  items: ListNodeType[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onPositionChange?: (itemId: number, newPosition: number, newParentId?: number) => void;
  onItemCreated?: () => Promise<void>;
};

export default function ListNodeList(props: ListNodeListProps) {
  const [newItems, setNewItems] = useState<ListNodeType[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && props.onPositionChange) {
      const oldIndex = props.items.findIndex((item) => item.id === Number(active.id));
      const newIndex = props.items.findIndex((item) => item.id === Number(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        props.onPositionChange(Number(active.id), newIndex);
      }
    }
  };

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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={props.items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-0.5">
          {props.items.length ? (props.items.map((item) => (
            <ListNode
              key={item.id}
              id={item.id}
              name={item.name}
              type={item.type as 'item' | 'sublist'}
              isChecked={item.isChecked}
              error={item.error}
              onToggle={props.onToggle}
              onDelete={props.onDelete}
            />
          ))) : (
            <li className="px-2 py-1 text-gray-500 italic">
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
          {newItems.length === 0 && (
            <li className="px-1 py-1 flex space-x-2">
              <button
                onClick={() => addNewEmptyItem('item')}
                className="px-10 py-0.25 bg-blue-600 hover:bg-blue-700 text-white rounded transition duration-200 cursor-pointer"
              >
                + Új elem
              </button>
              <button
                onClick={() => addNewEmptyItem('sublist')}
                className="px-10 py-0.25 bg-green-600 hover:bg-green-700 text-white rounded transition duration-200 cursor-pointer"
              >
                + Új lista
              </button>
            </li>
          )}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
