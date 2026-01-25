'use client';

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ListNodeType, ListNode } from './ListNode';

type ListNodeListProps = {
  items: ListNodeType[];
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onPositionChange?: (itemId: number, newPosition: number, newParentId?: number) => void;
};

export default function ListNodeList(props: ListNodeListProps) {
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

  if (props.items.length === 0) {
    return (
      <div className="px-3 py-1 text-gray-500 italic">
        Nincs még elem ebben a listában.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={props.items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-0.5">
          {props.items.map((item) => (
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
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
