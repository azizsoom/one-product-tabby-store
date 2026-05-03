'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/db';

const defaults: Record<string, string> = {
  shipping_policy: 'مدة الشحن من 3 أيام عمل إلى 7 أيام عمل، وشركة الشحن متعددة حسب المتوفر.',
  refund_policy: 'يقبل الاسترجاع أو الاستبدال خلال 7 أيام في حال وجود عيب أو خطأ في الطلب.',
  terms_policy: 'باستخدامك للمتجر فإنك توافق على الشروط والأحكام المنشورة.',
  privacy_policy: 'نحترم خصوصية العملاء ونستخدم البيانات لتنفيذ الطلب والشحن والدفع فقط.',
  contact_text: 'للتواصل: az@kco.sa - 0555868221',
};

export default function PoliciesAdminPage() {
  const [policies, setPolicies] = useState(defaults);
  const [message, setMessage] = useState('');

  useEffect(() => { loadPolicies(); }, []);

  async function loadPolicies() {
    const { data } = await db.from('store_settings').select('*');
    if (data) {
      const next = { ...defaults };
      data.forEach((row: any) => { if (row.key in next) next[row.key] = row.value || ''; });
      setPolicies(next);
    }
  }

  async function savePolicies() {
    const rows = Object.entries(policies).map(([key, value]) => ({ key, value }));
    const { error } = await db.from('store_settings').upsert(rows, { onConflict: 'key' });
    setMessage(error ? 'فشل الحفظ: ' + error.message : 'تم حفظ السياسات.');
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <div className="mx-auto max-w-5xl">
        <Link href="/admin" className="text-sm text-emerald-700">الرجوع للوحة التحكم</Link>
        <h1 className="mt-4 text-3xl font-black">السياسات</h1>
        <p className="mt-2 text-stone-600">تعديل مختصر السياسات ومحتواها التشغيلي.</p>
        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <TextArea label="سياسة الشحن" value={policies.shipping_policy} onChange={(v) => setPolicies({ ...policies, shipping_policy: v })} />
          <TextArea label="سياسة الاسترجاع والاستبدال" value={policies.refund_policy} onChange={(v) => setPolicies({ ...policies, refund_policy: v })} />
          <TextArea label="الشروط والأحكام" value={policies.terms_policy} onChange={(v) => setPolicies({ ...policies, terms_policy: v })} />
          <TextArea label="سياسة الخصوصية" value={policies.privacy_policy} onChange={(v) => setPolicies({ ...policies, privacy_policy: v })} />
          <TextArea label="تواصل معنا" value={policies.contact_text} onChange={(v) => setPolicies({ ...policies, contact_text: v })} />
          {message ? <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm">{message}</p> : null}
          <button onClick={savePolicies} className="mt-6 rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white">حفظ السياسات</button>
        </section>
      </div>
    </main>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="mb-4 block"><span className="mb-2 block text-sm font-bold text-stone-700">{label}</span><textarea className="input min-h-32" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}
