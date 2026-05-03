'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/db';

const defaults: Record<string, string> = {
  badge_text: 'جاهز لحساب ضريبة 15% وربط تابي',
  checkout_button_text: 'الدفع عبر تابي',
  feature_1: 'شحن مجاني',
  feature_2: 'كود خصم',
  feature_3: 'طلب مختصر',
  success_message: 'تم استلام طلبك بنجاح',
};

export default function ContentPage() {
  const [content, setContent] = useState(defaults);
  const [message, setMessage] = useState('');

  useEffect(() => { loadContent(); }, []);

  async function loadContent() {
    const { data } = await db.from('store_settings').select('*');
    if (data) {
      const next = { ...defaults };
      data.forEach((row: any) => { if (row.key in next) next[row.key] = row.value || ''; });
      setContent(next);
    }
  }

  async function saveContent() {
    const rows = Object.entries(content).map(([key, value]) => ({ key, value }));
    const { error } = await db.from('store_settings').upsert(rows, { onConflict: 'key' });
    setMessage(error ? 'فشل الحفظ: ' + error.message : 'تم حفظ محتوى الصفحة.');
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="text-sm text-emerald-700">الرجوع للوحة التحكم</Link>
        <h1 className="mt-4 text-3xl font-black">محتوى الصفحة</h1>
        <p className="mt-2 text-stone-600">تعديل النصوص العامة في واجهة المتجر.</p>
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="نص الشارة العلوية" value={content.badge_text} onChange={(v) => setContent({ ...content, badge_text: v })} />
            <Field label="نص زر الدفع" value={content.checkout_button_text} onChange={(v) => setContent({ ...content, checkout_button_text: v })} />
            <Field label="الميزة الأولى" value={content.feature_1} onChange={(v) => setContent({ ...content, feature_1: v })} />
            <Field label="الميزة الثانية" value={content.feature_2} onChange={(v) => setContent({ ...content, feature_2: v })} />
            <Field label="الميزة الثالثة" value={content.feature_3} onChange={(v) => setContent({ ...content, feature_3: v })} />
            <Field label="رسالة نجاح الطلب" value={content.success_message} onChange={(v) => setContent({ ...content, success_message: v })} />
          </div>
          {message ? <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm">{message}</p> : null}
          <button onClick={saveContent} className="mt-6 rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white">حفظ المحتوى</button>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label><span className="mb-2 block text-sm font-bold text-stone-700">{label}</span><input className="input" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
