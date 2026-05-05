'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/db';

type Setting = { key: string; value: string };

const defaults: Record<string, string> = {
  store_name: 'شركة المطارة',
  store_logo_url: '',
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

  async function uploadLogo(file: File) {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      setMessage('صيغة الشعار غير مدعومة. استخدم PNG أو JPG أو WEBP أو SVG.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setMessage('حجم الشعار كبير. الحد الأقصى 3MB.');
      return;
    }
    const extension = file.name.split('.').pop() || 'png';
    const filePath = `logos/store-logo-${Date.now()}.${extension}`;
    const { error } = await db.storage.from('product-images').upload(filePath, file, { cacheControl: '3600', upsert: true });
    if (error) {
      setMessage('فشل رفع الشعار: ' + error.message);
      return;
    }
    const { data } = db.storage.from('product-images').getPublicUrl(filePath);
    setSettings({ ...settings, store_logo_url: data.publicUrl });
    setMessage('تم رفع الشعار. اضغط حفظ الإعدادات لاعتماده.');
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

          <div className="mt-6 rounded-3xl bg-stone-50 p-5 ring-1 ring-stone-200">
            <h2 className="text-xl font-black">شعار المتجر</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-bold text-stone-700">رفع شعار من الجهاز</span>
                <input className="input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
              </label>
              <Field label="رابط الشعار" value={settings.store_logo_url} onChange={(v) => setSettings({ ...settings, store_logo_url: v })} />
            </div>
            {settings.store_logo_url ? (
              <div className="mt-4 rounded-2xl bg-white p-4 text-center ring-1 ring-stone-200">
                <img src={settings.store_logo_url} alt="شعار المتجر" className="mx-auto max-h-28 object-contain" />
              </div>
            ) : null}
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
