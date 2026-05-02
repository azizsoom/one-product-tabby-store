'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { ShoppingBag, ShieldCheck, Truck, BadgePercent } from 'lucide-react';
import { db } from '../lib/db';

const product = {
  name: 'مطارة الكريديس',
  subtitle: 'مطارة ماء عالية الجودة بصفحة شراء مختصرة وحسابات ضريبية دقيقة',
  priceBeforeVat: 100,
  shippingAmount: 0,
};

const preview = calculateOrder({
  unitPriceBeforeVat: product.priceBeforeVat,
  quantity: 1,
  discountType: 'percentage',
  discountValue: 10,
  shippingAmount: product.shippingAmount,
});

export default function HomePage() {
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function createTestOrder() {
    setSaving(true);
    setMessage('');

    const { error } = await db.from('orders').insert({
      customer_name: customerName || 'عميل تجريبي',
      customer_mobile: customerMobile || null,
      product_name: product.name,
      quantity: 1,
      unit_price_before_vat: product.priceBeforeVat,
      subtotal_before_discount: preview.subtotalBeforeDiscount,
      discount_code: 'TEST10',
      discount_amount: preview.discountAmount,
      taxable_amount: preview.taxableAmount,
      vat_rate: 0.15,
      vat_amount: preview.vatAmount,
      shipping_amount: preview.shippingAmount,
      total_amount: preview.totalAmount,
      payment_method: 'tabby',
      payment_status: 'pending',
      order_status: 'new',
    });

    setSaving(false);
    setMessage(error ? 'فشل إنشاء الطلب: ' + error.message : 'تم إنشاء طلب تجريبي. افتح لوحة الطلبات للتأكد.');
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-950" dir="rtl">
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-2 md:py-16">
        <div className="flex items-center justify-center rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-stone-200">
          <div className="flex h-80 w-80 items-center justify-center rounded-3xl bg-stone-100 text-center text-stone-500">
            صورة مطارة الكريديس
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
            <ShieldCheck size={18} /> جاهز لحساب ضريبة 15% وربط تابي
          </div>

          <h1 className="text-4xl font-black leading-tight md:text-5xl">{product.name}</h1>
          <p className="mt-4 text-lg leading-8 text-stone-600">{product.subtitle}</p>

          <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <div className="mb-5 flex items-center justify-between border-b border-stone-100 pb-4">
              <span className="text-stone-500">السعر قبل الضريبة</span>
              <strong className="text-2xl">{product.priceBeforeVat.toFixed(2)} ريال</strong>
            </div>

            <div className="space-y-3 text-sm">
              <Row label="خصم تجريبي 10%" value={`-${preview.discountAmount.toFixed(2)} ريال`} />
              <Row label="الصافي الخاضع للضريبة" value={`${preview.taxableAmount.toFixed(2)} ريال`} />
              <Row label="ضريبة القيمة المضافة 15%" value={`${preview.vatAmount.toFixed(2)} ريال`} />
              <Row label="الشحن" value="مجاني" />
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-stone-950 px-5 py-4 text-white">
                <span>الإجمالي للدفع عبر تابي</span>
                <strong className="text-2xl">{preview.totalAmount.toFixed(2)} ريال</strong>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <input className="input" placeholder="اسم العميل للتجربة" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <input className="input" placeholder="رقم الجوال للتجربة" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} />
            </div>

            {message ? <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm">{message}</p> : null}

            <button onClick={createTestOrder} disabled={saving} className="mt-6 w-full rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'جاري إنشاء الطلب...' : 'إنشاء طلب تجريبي قبل ربط تابي'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm text-stone-600">
            <Feature icon={<Truck size={20} />} text="شحن مجاني" />
            <Feature icon={<BadgePercent size={20} />} text="كود خصم" />
            <Feature icon={<ShoppingBag size={20} />} text="طلب مختصر" />
          </div>
        </div>
      </section>
    </main>
  );
}

function calculateOrder(input: {
  unitPriceBeforeVat: number;
  quantity: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  shippingAmount?: number;
}) {
  const vatRate = 0.15;
  const subtotalBeforeDiscount = roundMoney(input.unitPriceBeforeVat * input.quantity);
  const rawDiscount = input.discountType === 'percentage'
    ? subtotalBeforeDiscount * ((input.discountValue || 0) / 100)
    : (input.discountValue || 0);
  const discountAmount = roundMoney(Math.min(subtotalBeforeDiscount, Math.max(0, rawDiscount)));
  const taxableAmount = roundMoney(subtotalBeforeDiscount - discountAmount);
  const vatAmount = roundMoney(taxableAmount * vatRate);
  const shippingAmount = roundMoney(Math.max(0, input.shippingAmount || 0));
  const totalAmount = roundMoney(taxableAmount + vatAmount + shippingAmount);

  return { subtotalBeforeDiscount, discountAmount, taxableAmount, vatRate, vatAmount, shippingAmount, totalAmount };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-stone-500">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Feature({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      <div className="mx-auto mb-2 flex w-fit text-emerald-700">{icon}</div>
      {text}
    </div>
  );
}
