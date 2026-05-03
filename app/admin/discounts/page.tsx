'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/db';

type Discount = {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  max_discount_amount: number | null;
  is_active: boolean;
  usage_limit: number | null;
  used_count: number;
};

const emptyForm = {
  code: '',
  type: 'percentage' as 'percentage' | 'fixed',
  value: 0,
  max_discount_amount: '',
  usage_limit: '',
  is_active: true,
};

export default function DiscountsAdminPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { loadDiscounts(); }, []);

  async function loadDiscounts() {
    setLoading(true);
    const { data, error } = await db.from('discount_codes').select('*').order('created_at', { ascending: false });
    setMessage(error ? 'تعذر تحميل الأكواد: ' + error.message : '');
    setDiscounts((data || []) as Discount[]);
    setLoading(false);
  }

  async function addDiscount() {
    if (!form.code.trim()) return setMessage('أدخل كود الخصم.');
    if (Number(form.value) <= 0) return setMessage('أدخل قيمة خصم صحيحة.');
    setSaving(true);
    const { error } = await db.from('discount_codes').insert({
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      is_active: form.is_active,
    });
    setSaving(false);
    if (error) return setMessage('فشل إضافة الكود: ' + error.message);
    setForm(emptyForm);
    setMessage('تم إضافة كود الخصم.');
    loadDiscounts();
  }

  async function toggleDiscount(item: Discount) {
    await db.from('discount_codes').update({ is_active: !item.is_active }).eq('id', item.id);
    loadDiscounts();
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="text-sm text-emerald-700">الرجوع للوحة التحكم</Link>
        <h1 className="mt-4 text-3xl font-black">أكواد الخصم</h1>
        <p className="mt-2 text-stone-600">إضافة وتعطيل أكواد الخصم التي يستخدمها العميل في صفحة الشراء.</p>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <h2 className="text-xl font-black">إضافة كود جديد</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input className="input" placeholder="مثال: SAVE10" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
              <option value="percentage">خصم نسبة %</option>
              <option value="fixed">خصم مبلغ ثابت</option>
            </select>
            <input className="input" type="number" step="0.01" placeholder="قيمة الخصم" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
            <input className="input" type="number" step="0.01" placeholder="حد أقصى للخصم اختياري" value={form.max_discount_amount} onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })} />
            <input className="input" type="number" placeholder="عدد الاستخدام اختياري" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} />
            <label className="flex items-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm font-bold">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> فعال
            </label>
          </div>
          {message ? <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm">{message}</p> : null}
          <button onClick={addDiscount} disabled={saving} className="mt-4 rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white disabled:opacity-50">إضافة الكود</button>
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200">
          {loading ? <div className="p-6">جاري التحميل...</div> : discounts.length === 0 ? <div className="p-6 text-stone-600">لا توجد أكواد خصم.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-stone-100 text-stone-600"><tr><th className="p-3 text-right">الكود</th><th className="p-3 text-right">النوع</th><th className="p-3 text-right">القيمة</th><th className="p-3 text-right">الحد الأقصى</th><th className="p-3 text-right">الاستخدام</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">إجراء</th></tr></thead>
                <tbody>{discounts.map((d) => <tr key={d.id} className="border-t border-stone-100"><td className="p-3 font-black">{d.code}</td><td className="p-3">{d.type === 'percentage' ? 'نسبة' : 'مبلغ ثابت'}</td><td className="p-3">{d.value}{d.type === 'percentage' ? '%' : ' ريال'}</td><td className="p-3">{d.max_discount_amount ?? '-'}</td><td className="p-3">{d.used_count} / {d.usage_limit ?? 'غير محدود'}</td><td className="p-3">{d.is_active ? 'فعال' : 'موقوف'}</td><td className="p-3"><button onClick={() => toggleDiscount(d)} className="rounded-xl bg-stone-950 px-4 py-2 text-white">{d.is_active ? 'إيقاف' : 'تفعيل'}</button></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
