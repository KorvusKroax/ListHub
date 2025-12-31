'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.token); // vagy data.id_token, ha így adja vissza a backend
      window.location.href = '/';
    } else {
      setError('Hibás felhasználónév vagy jelszó');
    }
  };

  return (
    <main style={{ maxWidth: '30rem', margin: 'auto', padding: '2rem' }}>

      <h1>Bejelentkezés</h1><br/>
      <form onSubmit={handleSubmit}>

        <div>
          <label>Felhasználónév</label><br/>
          <input type="text" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
        </div>

        <div>
          <label>Jelszó</label><br/>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>

        <button type="submit" style={{ marginTop: '1rem' }}>Belépés</button>

        {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}

      </form>
    </main>
  );
}
