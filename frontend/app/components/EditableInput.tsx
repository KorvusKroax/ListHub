'use client';

type EditableInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export default function EditableInput(props: EditableInputProps) {
  return (
    <input
      type="text"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      className="flex-1 w-full px-2 bg-white text-gray-800 rounded focus:outline-none focus:ring-1 focus:ring-gray-200"
      autoFocus
      onBlur={props.onSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') props.onSave();
        if (e.key === 'Escape') props.onCancel();
      }}
    />
  );
}
