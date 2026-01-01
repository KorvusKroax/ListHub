'use client';

import { useState } from 'react';
import styles from './login.module.css';

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
    <main className={styles.container}>
      <h1 className={styles.title}>ListHub</h1>
      <br />
      <div className={styles.loginBox}>
        <h2>Bejelentkezés</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>
              Felhasználónév
            </label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required autoFocus className={styles.input} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>
              Jelszó
            </label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className={styles.input} />
          </div>
          <br />
          <button type="submit" className={styles.button}>
            Belépés
          </button>
        </form>
        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
