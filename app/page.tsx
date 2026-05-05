'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, ShieldCheck, Trash2 } from 'lucide-react';
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

type CartItem = {
  product: Product;
  quantity: number;
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('Test User');
  const [customerMobile, setCustomerMobile] = useState('+966500000001');
  const [customerEmail, setCustomerEmail] = useState('otp.success@tabby.ai');
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
    setLoading(false);
  }

  const preview = useMemo(() => calculateCartOrder(cart), [cart]);
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  function addToCart(product: Product) {
    setMessage('');
    const stock = Number(product.stock_quantity || 0);
    if (stock <= 0) {
      setMessage('هذا المنتج غير متوفر حاليًا.');
      return;
    }

    setCart((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= stock) {
          setMessage(`لا يمكن إضافة كمية أكبر من المتوفر للمنتج: ${product.name}`);
          return items;
        }
        return items.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...items, { product, quantity: 1 }];
    });

    setTimeout(() => {
      document.getElementById('cart-box')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function updateCartQuantity(productId: string, nextQuantity: number) {
    setMessage('');
    setCart((items) => items.map((item) => {
      if (item.product.id !== productId) return item;
      const stock = Number(item.product.stock_quantity || 0);
      const safeQuantity = Math.max(1, Math.min(stock || 1, Math.floor(nextQuantity || 1)));
      return { ...item, quantity: safeQuantity };
    }));
  }

  function removeFromCart(productId: string) {
    setCart((items) => items.filter((item) => item.product.id !== productId));
  }

  async function startTabbyCheckout() {
    setSaving(true);
    setMessage('');

    if (cart.length === 0) {
      setSaving(false);
      setMessage('السلة فارغة. أضف منتجًا واحدًا على الأقل.');
      return;
    }

    for (const item of cart) {
      if (item.quantity > Number(item.product.stock_quantity || 0)) {
        setSaving(false);
        setMessage(`الكمية المطلوبة أكبر من المتوفر للمنتج: ${item.product.name}`);
        return;
      }
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
        items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        customerName,
        customerMobile,
        customerEmail,
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
            <p className="mt-3 text-stone-600">أضف أكثر من منتج للسلة ثم أكمل الطلب مرة واحدة عبر تابي.</p>
          </div>

          <a href="#cart-box" className="rounded-2xl bg-stone-950 px-5 py-3 text-center font-bold text-white">
            السلة: {totalQuantity} منتج
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {products.map((product) => {
            const cartItem = cart.find((item) => item.product.id === product.id);
            return (
              <div key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-md">
                <div className="relative aspect-square bg-stone-100">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center p-4 text-center text-sm text-stone-500">صورة المنتج</div>
                  )}
                  {Number(product.stock_quantity || 0) <= 0 ? (
                    <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">نفدت</span>
                  ) : null}
                  {cartItem ? (
                    <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-1 text-xs font-bold text-white">في السلة: {cartItem.quantity}</span>
                  ) : null}
                </div>

                <div className="p-3">
                  <h2 className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-stone-700">{product.name}</h2>
                  <p className="mt-2 text-center text-xs font-black text-orange-500">أفضل سعر</p>
                  <p className="text-center text-2xl font-black text-stone-700">{Number(product.price_before_vat || 0).toFixed(0)}</p>
                  <p className="text-center text-xs text-stone-500">ريال قبل الضريبة</p>
                  <button onClick={() => addToCart(product)} disabled={Number(product.stock_quantity || 0) <= 0} className="mt-3 flex w-full items-center justify-between rounded-xl border border-stone-300 px-3 py-2 text-sm font-black text-stone-700 disabled:opacity-50">
                    <span>إضافة للسلة</span>
                    <span className="text-xl">+</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <section id="cart-box" className="mt-8 grid gap-6 lg:grid-cols-[1fr_420px]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <h2 className="text-2xl font-black">سلة المشتريات</h2>
            {cart.length === 0 ? (
              <p className="mt-4 rounded-2xl bg-stone-100 p-4 text-sm text-stone-600">السلة فارغة. اضغط إضافة للسلة على المنتجات التي تريدها.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {cart.map((item) => (
                  <div key={item.product.id} className="grid gap-3 rounded-2xl border border-stone-200 p-3 md:grid-cols-[80px_1fr_auto] md:items-center">
                    <div className="h-20 w-20 overflow-hidden rounded-xl bg-stone-100">
                      {item.product.image_url ? <img src={item.product.image_url} alt={item.product.name} className="h-full w-full object-cover" /> : null}
                    </div>
                    <div>
                      <h3 className="font-black">{item.product.name}</h3>
                      <p className="mt-1 text-sm text-stone-500">سعر الحبة قبل الضريبة: {Number(item.product.price_before_vat || 0).toFixed(2)} ريال</p>
                      <p className="text-sm text-stone-500">المتوفر: {Number(item.product.stock_quantity || 0)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)} className="h-10 w-10 rounded-xl bg-stone-100 text-lg font-black">-</button>
                      <input className="input max-w-20 text-center" type="number" min="1" max={Number(item.product.stock_quantity || 1)} value={item.quantity} onChange={(e) => updateCartQuantity(item.product.id, Number(e.target.value))} />
                      <button type="button" onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)} className="h-10 w-10 rounded-xl bg-stone-100 text-lg font-black">+</button>
                      <button type="button" onClick={() => removeFromCart(item.product.id)} className="h-10 w-10 rounded-xl bg-red-50 text-red-600"><Trash2 size={18} className="mx-auto" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <input className="input" placeholder="اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <input className="input" placeholder="رقم الجوال" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} />
              <input className="input" placeholder="البريد الإلكتروني" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
            <h2 className="text-2xl font-black">ملخص الطلب</h2>
            <div className="mt-5 space-y-3 text-sm">
              <Row label="عدد المنتجات" value={`${totalQuantity}`} />
              <Row label="المجموع قبل الخصم" value={`${preview.subtotalBeforeDiscount.toFixed(2)} ريال`} />
              <Row label="خصم تجريبي 10%" value={`-${preview.discountAmount.toFixed(2)} ريال`} />
              <Row label="الصافي الخاضع للضريبة" value={`${preview.taxableAmount.toFixed(2)} ريال`} />
              <Row label="ضريبة القيمة المضافة 15%" value={`${preview.vatAmount.toFixed(2)} ريال`} />
              <Row label="الشحن" value={preview.shippingAmount === 0 ? 'مجاني' : `${preview.shippingAmount.toFixed(2)} ريال`} />
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-stone-950 px-5 py-4 text-white">
                <span>الإجمالي</span>
                <strong className="text-2xl">{preview.totalAmount.toFixed(2)} ريال</strong>
              </div>
              {cart.length > 0 ? (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3 text-violet-950">
                  <p className="font-black">قسّمها على 4 دفعات مع تابي</p>
                  <p className="mt-1 text-sm">
                    تقريبًا {(Math.ceil((preview.totalAmount / 4) * 100) / 100).toFixed(2)} ريال لكل دفعة، بدون فوائد حسب قبول تابي.
                  </p>
                </div>
              ) : null}
            </div>

            {message ? <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm">{message}</p> : null}

            <button onClick={startTabbyCheckout} disabled={saving || cart.length === 0} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
              <ShoppingBag size={20} />
              {saving ? 'جاري تحويلك إلى تابي...' : 'الدفع عبر تابي'}
            </button>
          </div>
        </section>
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

function calculateCartOrder(cart: CartItem[]) {
  const vatRate = 0.15;
  const subtotalBeforeDiscount = roundMoney(cart.reduce((sum, item) => sum + Number(item.product.price_before_vat || 0) * item.quantity, 0));
  const discountAmount = roundMoney(subtotalBeforeDiscount * 0.10);
  const taxableAmount = roundMoney(subtotalBeforeDiscount - discountAmount);
  const vatAmount = roundMoney(taxableAmount * vatRate);
  const shippingAmount = roundMoney(cart.length === 0 ? 0 : Math.max(...cart.map((item) => Number(item.product.shipping_amount || 0))));
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
