
'use client';

import { useEffect, useState } from 'react';

type ListNode = {
  id: number;
  name: string;
};

export default function Home() {
  const [lists, setLists] = useState<ListNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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

  if (loading) return <main>Betöltés...</main>;
  if (!isLoggedIn) return <main>Kérlek, <a href="/login">jelentkezz be</a>!</main>;
  if (error) return <main>Hiba: {error}</main>;

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.reload();
  };

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Listáim</h1>
        <button onClick={handleLogout}>Kijelentkezés</button>
      </div>
      {lists.length === 0 ? (
        <p>Nincs elérhető lista.</p>
      ) : (
        <ul>
          {lists.map(list => (
            <li key={list.id}>{list.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
