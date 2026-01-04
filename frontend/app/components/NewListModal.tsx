import { useState } from 'react';

type NewListModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
};

export default function NewListModal({ isOpen, onClose, onSubmit }: NewListModalProps) {
  const [listName, setListName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listName.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(listName);
      setListName('');
      onClose();
    } catch (error) {
      console.error('Hiba a lista létrehozása során:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Új lista létrehozása</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={isSubmitting}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="listName" className="block text-sm font-medium text-gray-700 mb-2">
              Lista neve
            </label>
            <input
              type="text"
              id="listName"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Pl. Bevásárlólista"
              autoFocus
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition duration-200"
              disabled={isSubmitting}
            >
              Mégse
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !listName.trim()}
            >
              {isSubmitting ? 'Létrehozás...' : 'Létrehozás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
