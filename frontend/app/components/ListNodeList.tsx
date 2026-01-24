'use client';

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
  if (items.length === 0) {
    return (
      <div className="px-3 py-1 text-gray-500 italic">
        {emptyMessage}
      </div>
    );
  }

  return (
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
  );
}
