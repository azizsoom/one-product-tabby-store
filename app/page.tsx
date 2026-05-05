'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, ShieldCheck } from 'lucide-react';
import { db } from '../lib/db';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price_before_vat: number;
  shipping_amount: number;
  stock_quantity: number;
  image_url: string | null;
  is_active: boolean;
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const { data } = await db
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const items = (data || []).map((item: any) => ({
      ...item,
      stock_quantity: Number(item.stock_quantity ?? 0),
    })) as Product[];

    setProducts(items);
    if (items.length > 0) setSelectedProduct(items[0]);
    setLoading(false);
  }

  const stockQuantity = Number(selectedProduct?.stock_quantity ?? 0);
  const maxAllowedQuantity = Math.max(0, stockQuantity);

  const preview = useMemo(() => {
    if (!selectedProduct) return null;
    return calculateOrder({
      unitPriceBeforeVat: Number(selectedProduct.price_before_vat || 0),
      quantity,
      discountType: 'percentage',
      discountValue: 10,
      shippingAmount: Number(selectedProduct.shipping_amount || 0),
    });
  }, [selectedProduct, quantity]);

  function selectProduct(product: Product) {
    setSelectedProduct(product);
    setQuantity(1);
    setMessage('');
    setTimeout(() => {
      document.getElementById('checkout-box')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function updateQuantity(nextQuantity: number) {
    const safeQuantity = Math.max(1, Math.min(maxAllowedQuantity || 1, Math.floor(nextQuantity || 1)));
    setQuantity(safeQuantity);
  }

  async function startTabbyCheckout() {
    if (!selectedProduct || !preview) return;
    setSaving(true);
    setMessage('');

    if (maxAllowedQuantity <= 0) {
      setSaving(false);
      setMessage('المنتج غير متوفر حاليًا.');
      return;
    }

    if (quantity > maxAllowedQuantity) {
      setSaving(false);
      setMessage(`الكمية المطلوبة أكبر من المتوفر. المتوفر حاليًا ${maxAllowedQuantity}.`);
      return;
    }

    if (!customerName.trim() || !customerMobile.trim() || !customerEmail.trim()) {
      setSaving(false);
      setMessage('فضلاً أدخل الاسم ورقم الجوال والبريد الإلكتروني قبل المتابعة للدفع.');
      return;
    }

    if (!isValidEmail(customerEmail)) {
      setSaving(false);
      setMessage('صيغة البريد الإلكتروني غير صحيحة. مثال: name@example.com');
      return;
    }

    const response = await fetch('/api/checkout/tabby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: selectedProduct.id,
        customerName,
        customerMobile,
        customerEmail,
        quantity,
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
    return <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">جاري تحميل المنتجات...</main>;
  }

  if (products.length === 0) {
    return <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">لا توجد منتجات مفعلة.</main>;
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-950" dir="rtl">
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">
              <ShieldCheck size={18} /> جاهز لحساب الضريبة وربط تابي
            </div>
            <h1 className="text-3xl font-black md:text-5xl">منتجات المتجر</h1>
            <p className="mt-3 text-stone-600">اختر المنتج والكمية ثم أكمل الدفع عبر تابي.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => selectProduct(product)}
              className={`overflow-hidden rounded-2xl bg-white text-right shadow-sm ring-1 transition hover:-translate-y-1 hover:shadow-md ${selectedProduct?.id === product.id ? 'ring-2 ring-emerald-600' : 'ring-stone-200'}`}
            >
              <div className="relative aspect-square bg-stone-100">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center p-4 text-center text-sm text-stone-500">صورة المنتج</div>
                )}
                {Number(product.stock_quantity || 0) <= 0 ? (
                  <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">نفدت</span>
                ) : null}
              </div>

              <div className="p-3">
                <h2 className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-stone-700">{product.name}</h2>
                <p className="mt-2 text-center text-xs font-black text-orange-500">أفضل سعر</p>
                <p className="text-center text-2xl font-black text-stone-700">{Number(product.price_before_vat || 0).toFixed(0)}</p>
                <p className="text-center text-xs text-stone-500">ريال قبل الضريبة</p>
                <div className="mt-3 flex items-center justify-between rounded-xl border border-stone-300 px-3 py-2 text-sm font-black text-stone-700">
                  <span>إضافة للسلة</span>
                  <span className="text-xl">+</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {selectedProduct && preview ? (
          <section id="checkout-box" className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-2xl font-black">تفاصيل المنتج المختار</h2>
              <div className="mt-4 flex gap-4">
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-stone-100">
                  {selectedProduct.image_url ? <img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-full w-full object-cover" /> : null}
                </div>
                <div>
                  <h3 className="text-xl font-black">{selectedProduct.name}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600">{selectedProduct.description || 'منتج من متجرنا'}</p>
                  <p className="mt-2 text-sm text-stone-600">المتوفر: <strong className="text-stone-950">{maxAllowedQuantity}</strong></p>
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-bold text-stone-700">الكمية المطلوبة</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => updateQuantity(quantity - 1)} className="h-12 w-12 rounded-2xl bg-stone-100 text-xl font-black">-</button>
                  <input className="input max-w-28 text-center" type="number" min="1" max={maxAllowedQuantity || 1} value={quantity} onChange={(e) => updateQuantity(Number(e.target.value))} />
                  <button type="button" onClick={() => updateQuantity(quantity + 1)} className="h-12 w-12 rounded-2xl bg-stone-100 text-xl font-black">+</button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <input className="input" placeholder="اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                <input className="input" placeholder="رقم الجوال" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} />
                <input className="input" placeholder="البريد الإلكتروني" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <h2 className="text-2xl font-black">ملخص الطلب</h2>
              <div className="mt-5 space-y-3 text-sm">
                <Row label="سعر الحبة قبل الضريبة" value={`${Number(selectedProduct.price_before_vat || 0).toFixed(2)} ريال`} />
                <Row label="الكمية" value={`${quantity}`} />
                <Row label="المجموع قبل الخصم" value={`${preview.subtotalBeforeDiscount.toFixed(2)} ريال`} />
                <Row label="خصم تجريبي 10%" value={`-${preview.discountAmount.toFixed(2)} ريال`} />
                <Row label="الصافي الخاضع للضريبة" value={`${preview.taxableAmount.toFixed(2)} ريال`} />
                <Row label="ضريبة القيمة المضافة 15%" value={`${preview.vatAmount.toFixed(2)} ريال`} />
                <Row label="الشحن" value={preview.shippingAmount === 0 ? 'مجاني' : `${preview.shippingAmount.toFixed(2)} ريال`} />
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-stone-950 px-5 py-4 text-white">
                  <span>الإجمالي</span>
                  <strong className="text-2xl">{preview.totalAmount.toFixed(2)} ريال</strong>
                </div>
              </div>

              {message ? <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm">{message}</p> : null}

              <button onClick={startTabbyCheckout} disabled={saving || maxAllowedQuantity <= 0} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
                <ShoppingBag size={20} />
                {maxAllowedQuantity <= 0 ? 'غير متوفر حاليًا' : saving ? 'جاري تحويلك إلى تابي...' : 'الدفع عبر تابي'}
              </button>
            </div>
          </section>
        ) : null}
      </section>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-center text-sm text-stone-600">
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-stone-500">{label}</span>
      <strong className="text-left">{value}</strong>
    </div>
  );
}
