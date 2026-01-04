'use client';

type ListItemProps = {
  id: number;
  name: string;
  type: 'item' | 'sublist';
  isChecked: boolean;
  error?: string;
  onToggle?: (id: number) => void;
};

export default function ListItem({ id, name, type, isChecked, error, onToggle }: ListItemProps) {
  return (
    <li
      className={`flex flex-col gap-2 p-3 border rounded hover:bg-gray-100 transition ${
        error
          ? 'bg-red-50 border-red-300'
          : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        {type === 'item' ? (
          <>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => onToggle?.(id)}
              className="w-4 h-4 text-blue-600 rounded cursor-pointer"
            />
            <span className={isChecked ? 'line-through text-gray-400' : 'text-gray-800'}>
              {name}
            </span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="font-semibold text-gray-800 cursor-pointer hover:text-blue-600">
              {name}
            </span>
          </>
        )}
      </div>
      {error && (
        <div className="text-sm text-red-600 font-medium">
          {error}
        </div>
      )}
    </li>
  );
}
