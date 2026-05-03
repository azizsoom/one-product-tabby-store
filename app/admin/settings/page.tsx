'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/db';

type Setting = { key: string; value: string };

const defaults: Record<string, string> = {
  store_name: 'شركة المطارة',
  store_email: 'az@kco.sa',
  store_phone: '0555868221',
  store_city: 'الرياض',
  vat_number: '300339747477747',
  footer_text: 'شركة المطارة - الرياض',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaults);
  const [message, setMessage] = useState('');

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const { data } = await db.from('store_settings').select('*');
    if (data) {
      const next = { ...defaults };
      (data as Setting[]).forEach((row) => { next[row.key] = row.value || ''; });
      setSettings(next);
    }
  }

  async function saveSettings() {
    setMessage('');
    const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const { error } = await db.from('store_settings').upsert(rows, { onConflict: 'key' });
    setMessage(error ? 'فشل الحفظ: ' + error.message : 'تم حفظ إعدادات المتجر.');
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="text-sm text-emerald-700">الرجوع للوحة التحكم</Link>
        <h1 className="mt-4 text-3xl font-black">إعدادات المتجر</h1>
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="اسم المتجر" value={settings.store_name} onChange={(v) => setSettings({ ...settings, store_name: v })} />
            <Field label="البريد الإلكتروني" value={settings.store_email} onChange={(v) => setSettings({ ...settings, store_email: v })} />
            <Field label="رقم الجوال / واتساب" value={settings.store_phone} onChange={(v) => setSettings({ ...settings, store_phone: v })} />
            <Field label="المدينة" value={settings.store_city} onChange={(v) => setSettings({ ...settings, store_city: v })} />
            <Field label="الرقم الضريبي" value={settings.vat_number} onChange={(v) => setSettings({ ...settings, vat_number: v })} />
            <Field label="نص الفوتر" value={settings.footer_text} onChange={(v) => setSettings({ ...settings, footer_text: v })} />
          </div>
          {message ? <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm">{message}</p> : null}
          <button onClick={saveSettings} className="mt-6 rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white">حفظ الإعدادات</button>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-2 block text-sm font-bold text-stone-700">{label}</span><input className="input" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
