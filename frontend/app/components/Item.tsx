'use client';

type ListItemProps = {
  id: number;
  isChecked: boolean;
  isEditing: boolean;
  displayName: string;
  editName: string;
  setIsEditing: (isEditing: boolean) => void;
  setEditName: (name: string) => void;
  handleSaveEdit: () => void;
  handleCancelEdit: () => void;
  onToggle?: (id: number) => void;
};

export default function Item(props: ListItemProps) {
  return (
    <>
      <input
        type="checkbox"
        checked={props.isChecked}
        onChange={() => props.onToggle?.(props.id)}
        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
      />

      {props.isEditing ? (
        <input
          type="text"
          value={props.editName}
          onChange={(e) => props.setEditName(e.target.value)}
          className="flex-1 px-2 py-1 border border-blue-500 rounded text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className={`flex-1 cursor-text ${props.isChecked ? 'line-through text-gray-400' : 'text-gray-800 hover:text-blue-600'}`}
        >
          {props.displayName}
        </span>
      )}
    </>
  );
}
