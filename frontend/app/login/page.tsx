'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateForm = () => {
    let isValid = true;
    setUsernameError('');
    setPasswordError('');

    if (!username.trim()) {
      setUsernameError('A felhasználónév megadása kötelező');
      isValid = false;
    }

    if (!password) {
      setPasswordError('A jelszó megadása kötelező');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('A jelszó legalább 6 karakter hosszú legyen');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        window.location.href = '/';
      } else {
        setError('Hibás felhasználónév vagy jelszó');
      }
    } catch (err) {
      setError('Hálózati hiba történt. Kérjük, próbálja meg később.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex items-center justify-center p-4 my-8">

      <div className="w-full max-w-md bg-white rounded shadow-lg p-8">

          <h2 className="text-xl font-semibold text-gray-600 text-center mb-8">Bejelentkezés</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 text-sm font-medium flex items-center">
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Felhasználónév
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setUsernameError('');
                }}
                disabled={isLoading}
                autoFocus
                className={`w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 transition ${
                  usernameError
                    ? 'border-red-300 focus:ring-red-500 bg-red-50'
                    : 'border-gray-300 focus:ring-blue-500'
                } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                placeholder="felhasználónév"
              />
              {usernameError && (
                <p className="mt-1 text-sm text-red-600">{usernameError}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Jelszó
              </label>
              <div className="space-y-2">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setPasswordError('');
                  }}
                  disabled={isLoading}
                  className={`w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 transition ${
                    passwordError
                      ? 'border-red-300 focus:ring-red-500 bg-red-50'
                      : 'border-gray-300 focus:ring-blue-500'
                  } disabled:bg-gray-100 disabled:cursor-not-allowed`}
                  placeholder="jelszó"
                />
                <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
                  />
                  <span>Jelszó megjelenítése</span>
                </label>
              </div>
              {passwordError && (
                <p className="mt-1 text-sm text-red-600">{passwordError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded transition duration-200 flex items-center justify-center disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center gap-3">
                  <span className="h-4 w-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <span>Bejelentkezés</span>
                </span>
              ) : (
                'Belépés'
              )}
            </button>
          </form>

      </div>

    </main>
  );
}
