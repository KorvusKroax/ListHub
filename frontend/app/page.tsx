'use client';

import { useEffect, useState } from 'react';
import ListCard from './components/ListCard';
import NewListModal from './components/NewListModal';

type ListNode = {
  id: number;
  name: string;
};

export default function Home() {
  const [lists, setLists] = useState<ListNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setIsLoggedIn(false);
      setLoading(false);
      return;
    }
    setIsLoggedIn(true);

    fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/listnodes`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Nem sikerült lekérni a listákat');
        }
        return res.json();
      })
      .then((data) => {
        setLists(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleCreateList = async (name: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/listnodes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        type: 'sublist'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API hiba:', response.status, errorData);
      throw new Error(errorData.message || `Nem sikerült létrehozni a listát (${response.status})`);
    }

    const newList = await response.json();
    setLists([...lists, newList]);
  };

  if (loading) return (
    <main className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
        <p className="mt-4 text-gray-600">Betöltés...</p>
      </div>
    </main>
  );

  if (!isLoggedIn) return window.location.href = '/login';

  if (error) return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
      <div className="bg-red-50 border border-red-200 rounded p-6 max-w-md">
        <h2 className="text-red-800 font-semibold text-lg mb-2">Hiba történt</h2>
        <p className="text-red-600">{error}</p>
      </div>
    </main>
  );

  return (
    <main className="py-8 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      <div className="bg-white rounded shadow-xl p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Listáim</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition duration-200 shadow-md hover:shadow-lg"
          >
            + Új lista
          </button>
        </div>

        {lists.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-24 w-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-4 text-xl text-gray-500">Nincs elérhető lista.</p>
            <p className="mt-2 text-gray-400">Hozd létre az első listádat!</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {lists.map(list => (
              <ListCard key={list.id} list={list} />
            ))}
          </div>
        )}
      </div>

      <NewListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateList}
      />
    </main>
  );
}
