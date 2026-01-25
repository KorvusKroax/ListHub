'use client';

import EditableInput from './EditableInput';

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
        <EditableInput
          value={props.editName}
          onChange={props.setEditName}
          onSave={props.handleSaveEdit}
          onCancel={props.handleCancelEdit}
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
