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
  emptyMessage?: string;
};

export default function ListNodeList({
  items,
  onToggle,
  onDelete,
  emptyMessage = 'Nincs még elem ebben a listában.'
}: ListNodeListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <ListItem
          key={item.id}
          id={item.id}
          name={item.name}
          type={item.type as 'item' | 'sublist'}
          isChecked={item.isChecked}
          error={item.error}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
