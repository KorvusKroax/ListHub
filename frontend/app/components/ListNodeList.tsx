'use client';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import ListItem from './ListItem';

type ListNode = {
  id: number;
  name: string;
  type: string;
  isChecked: boolean;
  error?: string;
};

type ListNodeListProps = {
  items: ListNode[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onPositionChange?: (itemId: number, newPosition: number) => void;
  emptyMessage?: string;
};

export default function ListNodeList({
  items,
  onToggle,
  onDelete,
  onPositionChange,
  emptyMessage = 'Nincs még elem ebben a listában.'
}: ListNodeListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && onPositionChange) {
      const oldIndex = items.findIndex((item) => item.id === Number(active.id));
      const newIndex = items.findIndex((item) => item.id === Number(over.id));

      if (oldIndex !== -1 && newIndex !== -1) {
        onPositionChange(Number(active.id), newIndex);
      }
    }
  };

  if (items.length === 0) {
    return (
      <div className="px-3 py-1 text-gray-500 italic">
        {emptyMessage}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-0.5">
          {items.map((item, index) => (
            <ListItem
              key={item.id}
              id={item.id}
              name={item.name}
              type={item.type as 'item' | 'sublist'}
              isChecked={item.isChecked}
              error={item.error}
              index={index}
              totalItems={items.length}
              onToggle={onToggle}
              onDelete={onDelete}
              onPositionChange={onPositionChange}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
