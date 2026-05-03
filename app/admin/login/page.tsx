'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/admin';
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');

    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    setLoading(false);

    if (!response.ok) {
      setMessage('كلمة المرور غير صحيحة');
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 text-stone-950" dir="rtl">
      <form onSubmit={login} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm ring-1 ring-stone-200">
        <h1 className="text-3xl font-black">دخول لوحة التحكم</h1>
        <p className="mt-2 text-sm text-stone-600">أدخل كلمة المرور للمتابعة.</p>

        <label className="mt-6 block">
          <span className="mb-2 block text-sm font-bold text-stone-700">كلمة المرور</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
        </label>

        {message ? <p className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}

        <button disabled={loading} className="mt-6 w-full rounded-2xl bg-emerald-600 px-6 py-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
          {loading ? 'جاري التحقق...' : 'دخول'}
        </button>
      </form>
    </main>
  );
}
