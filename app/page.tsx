'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, ShieldCheck, Truck, BadgePercent } from 'lucide-react';
import { db } from '../lib/db';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_before_vat: number;
  shipping_amount: number;
  image_url: string | null;
  is_active: boolean;
};

export default function HomePage() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProduct();
  }, []);

  async function loadProduct() {
    setLoading(true);
    const { data, error } = await db
      .from('products')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!error && data) {
      setProduct(data);
    }
    setLoading(false);
  }

  const preview = useMemo(() => {
    if (!product) return null;
    return calculateOrder({
      unitPriceBeforeVat: Number(product.price_before_vat || 0),
      quantity: 1,
      discountType: 'percentage',
      discountValue: 10,
      shippingAmount: Number(product.shipping_amount || 0),
    });
  }, [product]);

  async function startTabbyCheckout() {
    if (!product || !preview) return;
    setSaving(true);
    setMessage('');

    if (!customerName.trim() || !customerMobile.trim()) {
      setSaving(false);
      setMessage('فضلاً أدخل الاسم ورقم الجوال قبل المتابعة للدفع.');
      return;
    }

    const response = await fetch('/api/checkout/tabby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName,
        customerMobile,
        customerEmail: customerEmail || 'customer@example.com',
      }),
    });

    const data = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok || !data.webUrl) {
      setMessage('تعذر إنشاء دفع تابي: ' + (data.error || data.details?.message || 'خطأ غير معروف'));
      return;
    }

    window.location.href = data.webUrl;
  }

  if (loading) {
    return <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">جاري تحميل المنتج...</main>;
  }

  if (!product || !preview) {
    return <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">لا يوجد منتج مفعل.</main>;
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-950" dir="rtl">
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-10 md:grid-cols-2 md:py-16">
        <div className="flex items-center justify-center rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-stone-200">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="max-h-96 w-full object-contain" />
          ) : (
            <div className="flex h-80 w-80 items-center justify-center rounded-3xl bg-stone-100 text-center text-stone-500">
              صورة {product.name}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
            <ShieldCheck size={18} /> جاهز لحساب ضريبة 15% وربط تابي
          </div>

          <h1 className="text-4xl font-black leading-tight md:text-5xl">{product.name}</h1>
          <p className="mt-4 text-lg leading-8 text-stone-600">{product.description || 'منتج بصفحة شراء مختصرة وحسابات ضريبية دقيقة'}</p>

          <div className="mt-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <div className="mb-5 flex items-center justify-between border-b border-stone-100 pb-4">
              <span className="text-stone-500">السعر قبل الضريبة</span>
              <strong className="text-2xl">{Number(product.price_before_vat || 0).toFixed(2)} ريال</strong>
            </div>

            <div className="space-y-3 text-sm">
              <Row label="خصم تجريبي 10%" value={`-${preview.discountAmount.toFixed(2)} ريال`} />
              <Row label="الصافي الخاضع للضريبة" value={`${preview.taxableAmount.toFixed(2)} ريال`} />
              <Row label="ضريبة القيمة المضافة 15%" value={`${preview.vatAmount.toFixed(2)} ريال`} />
              <Row label="الشحن" value={preview.shippingAmount === 0 ? 'مجاني' : `${preview.shippingAmount.toFixed(2)} ريال`} />
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-stone-950 px-5 py-4 text-white">
                <span>الإجمالي للدفع عبر تابي</span>
                <strong className="text-2xl">{preview.totalAmount.toFixed(2)} ريال</strong>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <input className="input" placeholder="اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <input className="input" placeholder="رقم الجوال" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} />
              <input className="input" placeholder="البريد الإلكتروني اختياري" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </div>

            {message ? <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm">{message}</p> : null}

            <button onClick={startTabbyCheckout} disabled={saving} className="mt-6 w-full rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'جاري تحويلك إلى تابي...' : 'الدفع عبر تابي'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-sm text-stone-600">
            <Feature icon={<Truck size={20} />} text={preview.shippingAmount === 0 ? 'شحن مجاني' : 'شحن محسوب'} />
            <Feature icon={<BadgePercent size={20} />} text="كود خصم" />
            <Feature icon={<ShoppingBag size={20} />} text="طلب مختصر" />
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-5 pb-10 text-center text-sm text-stone-600">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
          <p className="font-bold text-stone-900">شركة المطارة</p>
          <p className="mt-1">الرياض - الرقم الضريبي: 300339747477747</p>
          <nav className="mt-4 flex flex-wrap justify-center gap-3">
            <Link className="hover:text-emerald-700" href="/shipping-policy">سياسة الشحن</Link>
            <Link className="hover:text-emerald-700" href="/refund-policy">الاسترجاع والاستبدال</Link>
            <Link className="hover:text-emerald-700" href="/terms">الشروط والأحكام</Link>
            <Link className="hover:text-emerald-700" href="/privacy">سياسة الخصوصية</Link>
            <Link className="hover:text-emerald-700" href="/contact">تواصل معنا</Link>
          </nav>
        </div>
      </footer>
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
