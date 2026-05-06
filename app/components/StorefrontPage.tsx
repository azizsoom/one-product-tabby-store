'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Search, ShoppingBag, ShieldCheck, Trash2, Truck, Store, X } from 'lucide-react';
import { db } from '../../lib/db';
import TabbyPromoWidget from './TabbyPromoWidget';

type Product = { id: string; name: string; description: string | null; price_before_vat: number; shipping_amount: number; stock_quantity: number; image_url: string | null; is_active: boolean; created_at?: string };
type CartItem = { product: Product; quantity: number };
type DiscountCode = { code: string; type: 'percentage' | 'fixed'; value: number; max_discount_amount: number | null; is_active: boolean; usage_limit: number | null; used_count: number };
type ShippingOption = { id: string; deliveryOptionId: string | null; company: string; service: string; price: number; currency: string; eta: string; raw?: any };
type StoreSettings = { store_name: string; store_logo_url: string; store_city: string; vat_number: string; store_phone: string; store_email: string };

const defaultSettings: StoreSettings = { store_name: 'شركة المطارة', store_logo_url: '', store_city: 'الرياض', vat_number: '300339747477747', store_phone: '0555868221', store_email: 'az@kco.sa' };

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
  const [discountMessage, setDiscountMessage] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'shipping' | 'pickup'>('shipping');
  const [shippingCity, setShippingCity] = useState('الرياض');
  const [shippingDistrict, setShippingDistrict] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingOption | null>(null);
  const [shippingMessage, setShippingMessage] = useState('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState('Test User');
  const [customerMobile, setCustomerMobile] = useState('+966500000001');
  const [customerEmail, setCustomerEmail] = useState('otp.success@tabby.ai');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { document.body.style.overflow = cartOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [cartOpen]);
  useEffect(() => { setSelectedShipping(null); setShippingOptions([]); setShippingMessage(''); }, [shippingCity, fulfillmentType, cart.length]);

  async function loadInitialData() {
    setLoading(true);
    const [{ data: productRows }, { data: settingRows }] = await Promise.all([
      db.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false }),
      db.from('store_settings').select('key,value'),
    ]);
    const loadedSettings = { ...defaultSettings };
    (settingRows || []).forEach((row: any) => { if (row.key in loadedSettings) loadedSettings[row.key as keyof StoreSettings] = row.value || ''; });
    setSettings(loadedSettings);
    setProducts(((productRows || []) as any[]).map((item) => ({ ...item, stock_quantity: Number(item.stock_quantity ?? 0) })) as Product[]);
    setLoading(false);
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((product) => !q || [product.name, product.description].some((value) => String(value || '').toLowerCase().includes(q)));
    return [...list].sort((a, b) => {
      if (sortBy === 'price_low') return Number(a.price_before_vat || 0) - Number(b.price_before_vat || 0);
      if (sortBy === 'price_high') return Number(b.price_before_vat || 0) - Number(a.price_before_vat || 0);
      if (sortBy === 'stock') return Number(b.stock_quantity || 0) - Number(a.stock_quantity || 0);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [products, search, sortBy]);

  const preview = useMemo(() => calculateCartOrder(cart, appliedDiscount, fulfillmentType, selectedShipping), [cart, appliedDiscount, fulfillmentType, selectedShipping]);
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const availableCount = products.filter((product) => Number(product.stock_quantity || 0) > 0).length;

  function addToCart(product: Product) {
    setMessage('');
    const stock = Number(product.stock_quantity || 0);
    if (stock <= 0) return setMessage('هذا المنتج غير متوفر حاليًا.');
    setCart((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= stock) { setMessage(`لا يمكن إضافة كمية أكبر من المتوفر للمنتج: ${product.name}`); return items; }
        return items.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...items, { product, quantity: 1 }];
    });
    setCartOpen(true);
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

  function removeFromCart(productId: string) { setCart((items) => items.filter((item) => item.product.id !== productId)); }

  async function applyDiscountCode() {
    const code = discountCode.trim().toUpperCase();
    setDiscountMessage(''); setAppliedDiscount(null);
    if (!code) return setDiscountMessage('اكتب كود الخصم أولاً.');
    if (cart.length === 0) return setDiscountMessage('أضف منتجات للسلة قبل استخدام الخصم.');
    const { data, error } = await db.from('discount_codes').select('*').eq('code', code).single();
    const discount = data as DiscountCode | null;
    if (error || !discount || !discount.is_active) return setDiscountMessage('كود الخصم غير صحيح أو غير فعال.');
    if (discount.usage_limit !== null && Number(discount.used_count || 0) >= Number(discount.usage_limit)) return setDiscountMessage('كود الخصم تجاوز حد الاستخدام.');
    if (Number(discount.value || 0) <= 0) return setDiscountMessage('قيمة كود الخصم غير صحيحة.');
    setAppliedDiscount(discount); setDiscountCode(discount.code); setDiscountMessage(`تم تطبيق كود الخصم ${discount.code}.`);
  }

  function removeDiscount() { setAppliedDiscount(null); setDiscountCode(''); setDiscountMessage('تم حذف كود الخصم.'); }

  async function fetchShippingOptions() {
    setShippingMessage(''); setShippingOptions([]); setSelectedShipping(null);
    if (cart.length === 0) return setShippingMessage('أضف منتجات للسلة أولاً.');
    if (!shippingCity.trim()) return setShippingMessage('أدخل مدينة الشحن أولاً.');
    setShippingLoading(true);
    const response = await fetch('/api/shipping/oto-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destinationCity: shippingCity, destinationCountry: 'SA', items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })) }),
    });
    const data = await response.json().catch(() => ({}));
    setShippingLoading(false);
    if (!response.ok) return setShippingMessage(data.error || 'تعذر حساب الشحن.');
    const options = Array.isArray(data.options) ? data.options : [];
    setShippingOptions(options);
    if (options[0]) setSelectedShipping(options[0]);
    setShippingMessage(data.warning || `تم جلب ${options.length} خيار شحن.`);
  }

  async function startTabbyCheckout() {
    setSaving(true); setMessage('');
    if (cart.length === 0) { setSaving(false); setMessage('السلة فارغة. أضف منتجًا واحدًا على الأقل.'); setCartOpen(true); return; }
    for (const item of cart) { if (item.quantity > Number(item.product.stock_quantity || 0)) { setSaving(false); setMessage(`الكمية المطلوبة أكبر من المتوفر للمنتج: ${item.product.name}`); return; } }
    if (!customerName.trim() || !customerMobile.trim() || !customerEmail.trim()) { setSaving(false); setMessage('فضلاً أدخل الاسم ورقم الجوال والبريد الإلكتروني قبل المتابعة للدفع.'); return; }
    if (!isValidEmail(customerEmail)) { setSaving(false); setMessage('صيغة البريد الإلكتروني غير صحيحة. مثال: name@example.com'); return; }
    if (fulfillmentType === 'shipping' && (!shippingCity.trim() || !shippingAddress.trim())) { setSaving(false); setMessage('فضلاً أدخل المدينة والعنوان التفصيلي للشحن.'); return; }
    if (fulfillmentType === 'shipping' && !selectedShipping) { setSaving(false); setMessage('فضلاً احسب الشحن واختر شركة الشحن قبل الدفع.'); return; }
    const response = await fetch('/api/checkout/tabby', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        customerName, customerMobile, customerEmail, discountCode: appliedDiscount?.code || '',
        shippingInfo: { fulfillmentType, city: shippingCity, district: shippingDistrict, address: shippingAddress, notes: shippingNotes, selectedOption: selectedShipping },
      }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok || !data.webUrl) { setMessage('تعذر إنشاء دفع تابي: ' + (data.error || data.details?.message || 'خطأ غير معروف')); return; }
    window.location.href = data.webUrl;
  }

  if (loading) return <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">جاري تحميل المتجر...</main>;
  if (products.length === 0) return <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">لا توجد منتجات مفعلة.</main>;

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-stone-50 text-stone-950" dir="rtl">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200">{settings.store_logo_url ? <img src={settings.store_logo_url} alt={settings.store_name} className="h-full w-full object-contain p-1" /> : <Store size={28} className="text-emerald-700" />}</div><div><h1 className="text-lg font-black md:text-2xl">{settings.store_name}</h1><p className="text-xs text-stone-500 md:text-sm">{settings.store_city} · دفع آمن عبر تابي</p></div></div><button type="button" onClick={() => setCartOpen(true)} className="relative rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white shadow-sm md:px-6">السلة <span className="mr-2 rounded-full bg-emerald-500 px-2 py-0.5 text-xs">{totalQuantity}</span></button></div></header>
      <section className="mx-auto max-w-7xl px-4 py-8"><div className="mb-8 rounded-[2rem] bg-stone-950 p-6 text-white shadow-sm md:p-8"><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-emerald-100"><ShieldCheck size={18} /> متجر متعدد المنتجات مربوط بتابي</div><h2 className="mt-5 text-3xl font-black leading-tight md:text-5xl">اختر منتجاتك واجمعها في طلب واحد</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-stone-200 md:text-base">ابحث عن المنتج، رتب النتائج، أضف للسلة، ثم أكمل الدفع من النافذة المنبثقة.</p></div>
        <section className="mb-5 rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-stone-200"><div className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-center"><label className="relative block"><Search className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} /><input className="input pr-11" placeholder="ابحث باسم المنتج أو الوصف" value={search} onChange={(e) => setSearch(e.target.value)} /></label><select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="newest">الأحدث أولًا</option><option value="price_low">السعر من الأقل</option><option value="price_high">السعر من الأعلى</option><option value="stock">الأكثر توفرًا</option></select><div className="rounded-2xl bg-stone-50 px-4 py-3 text-sm font-bold text-stone-700 ring-1 ring-stone-200">{filteredProducts.length} ظاهر / {availableCount} متوفر</div></div></section>
        {message && !cartOpen ? <p className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{message}</p> : null}
        {filteredProducts.length === 0 ? <div className="rounded-[2rem] bg-white p-8 text-center text-stone-600 shadow-sm ring-1 ring-stone-200">لا توجد منتجات مطابقة للبحث.</div> : <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">{filteredProducts.map((product) => { const cartItem = cart.find((item) => item.product.id === product.id); const isOut = Number(product.stock_quantity || 0) <= 0; return <div key={product.id} className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-lg"><div className="relative aspect-square bg-stone-100">{product.image_url ? <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center p-4 text-center text-sm text-stone-500">صورة المنتج</div>}{isOut ? <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">نفدت</span> : null}{cartItem ? <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-1 text-xs font-bold text-white">في السلة: {cartItem.quantity}</span> : null}</div><div className="p-3"><h3 className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-stone-800">{product.name}</h3><div className="mt-3 rounded-2xl bg-stone-50 p-3 text-center"><p className="text-xs font-bold text-orange-500">أفضل سعر</p><p className="text-2xl font-black text-stone-900">{Number(product.price_before_vat || 0).toFixed(0)}</p><p className="text-xs text-stone-500">ريال قبل الضريبة</p></div><button onClick={() => addToCart(product)} disabled={isOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-3 py-3 text-sm font-black text-white transition hover:bg-emerald-700 disabled:bg-stone-300"><ShoppingBag size={16} /> إضافة للسلة</button></div></div>; })}</div>}
      </section>
      {cartOpen ? <div className="fixed inset-0 z-50"><button aria-label="إغلاق السلة" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCartOpen(false)} /><aside className="absolute left-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl md:rounded-r-[2rem]" dir="rtl"><div className="flex items-center justify-between border-b border-stone-200 p-4"><div><h2 className="text-2xl font-black">سلة المشتريات</h2><p className="text-sm text-stone-500">{totalQuantity} منتج في السلة</p></div><button onClick={() => setCartOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700"><X size={22} /></button></div><div className="flex-1 overflow-y-auto p-4">
        {cart.length === 0 ? <div className="rounded-3xl bg-stone-50 p-6 text-center ring-1 ring-stone-200"><ShoppingBag className="mx-auto mb-3 text-stone-400" size={38} /><p className="font-black">السلة فارغة</p><p className="mt-1 text-sm text-stone-500">أضف المنتجات من الصفحة الرئيسية.</p></div> : <div className="space-y-3">{cart.map((item) => <div key={item.product.id} className="rounded-3xl border border-stone-200 p-3"><div className="flex gap-3"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-stone-100">{item.product.image_url ? <img src={item.product.image_url} alt={item.product.name} className="h-full w-full object-cover" /> : null}</div><div className="min-w-0 flex-1"><h3 className="line-clamp-2 font-black">{item.product.name}</h3><p className="mt-1 text-sm text-stone-500">{Number(item.product.price_before_vat || 0).toFixed(2)} ريال قبل الضريبة</p><p className="text-xs text-stone-500">المتوفر: {Number(item.product.stock_quantity || 0)}</p></div><button type="button" onClick={() => removeFromCart(item.product.id)} className="h-10 w-10 shrink-0 rounded-2xl bg-red-50 text-red-600"><Trash2 size={17} className="mx-auto" /></button></div><div className="mt-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2"><button type="button" onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)} className="h-10 w-10 rounded-xl bg-stone-100 text-lg font-black">-</button><input className="input max-w-20 text-center" type="number" min="1" max={Number(item.product.stock_quantity || 1)} value={item.quantity} onChange={(e) => updateCartQuantity(item.product.id, Number(e.target.value))} /><button type="button" onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)} className="h-10 w-10 rounded-xl bg-stone-100 text-lg font-black">+</button></div><strong>{(Number(item.product.price_before_vat || 0) * item.quantity).toFixed(2)} ريال</strong></div></div>)}</div>}
        <div className="mt-4 rounded-3xl bg-stone-50 p-4 ring-1 ring-stone-200"><h3 className="font-black">كود الخصم</h3><div className="mt-3 flex gap-2"><input className="input" placeholder="مثال: SAVE10" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} /><button onClick={applyDiscountCode} className="rounded-2xl bg-stone-950 px-4 font-bold text-white">تطبيق</button></div>{appliedDiscount ? <button onClick={removeDiscount} className="mt-2 text-xs font-bold text-red-600">إزالة الخصم</button> : null}{discountMessage ? <p className="mt-2 text-xs text-stone-600">{discountMessage}</p> : null}</div>
        <div className="mt-4 rounded-3xl bg-stone-50 p-4 ring-1 ring-stone-200"><h3 className="font-black">بيانات العميل</h3><div className="mt-3 grid gap-3"><input className="input" placeholder="اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /><input className="input" placeholder="رقم الجوال" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} /><input className="input" placeholder="البريد الإلكتروني" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div></div>
        <div className="mt-4 rounded-3xl bg-stone-50 p-4 ring-1 ring-stone-200"><h3 className="font-black">الشحن والاستلام</h3><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => setFulfillmentType('shipping')} className={`rounded-2xl px-4 py-3 text-sm font-bold ring-1 ${fulfillmentType === 'shipping' ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-stone-700 ring-stone-200'}`}>شحن</button><button onClick={() => setFulfillmentType('pickup')} className={`rounded-2xl px-4 py-3 text-sm font-bold ring-1 ${fulfillmentType === 'pickup' ? 'bg-emerald-600 text-white ring-emerald-600' : 'bg-white text-stone-700 ring-stone-200'}`}>استلام من الفرع</button></div>{fulfillmentType === 'shipping' ? <div className="mt-3 grid gap-3"><input className="input" placeholder="المدينة" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} /><input className="input" placeholder="الحي" value={shippingDistrict} onChange={(e) => setShippingDistrict(e.target.value)} /><textarea className="input min-h-20" placeholder="العنوان التفصيلي" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} /><textarea className="input min-h-16" placeholder="ملاحظات إضافية للطلب اختياري" value={shippingNotes} onChange={(e) => setShippingNotes(e.target.value)} /><button onClick={fetchShippingOptions} disabled={shippingLoading || cart.length === 0} className="rounded-2xl bg-sky-600 px-4 py-3 font-bold text-white disabled:opacity-50">{shippingLoading ? 'جاري حساب الشحن...' : 'حساب خيارات الشحن'}</button>{shippingMessage ? <p className="text-xs text-stone-600">{shippingMessage}</p> : null}{shippingOptions.length > 0 ? <div className="grid gap-2">{shippingOptions.map((option) => <button key={option.id} onClick={() => setSelectedShipping(option)} className={`rounded-2xl p-3 text-right ring-1 ${selectedShipping?.id === option.id ? 'bg-emerald-50 ring-emerald-500' : 'bg-white ring-stone-200'}`}><div className="flex items-center justify-between gap-2"><strong>{option.company}</strong><strong>{Number(option.price || 0).toFixed(2)} {option.currency || 'SAR'}</strong></div><p className="mt-1 text-xs text-stone-500">{option.service}{option.eta ? ` - ${option.eta}` : ''}</p></button>)}</div> : null}</div> : <p className="mt-3 rounded-2xl bg-white p-3 text-sm text-stone-600 ring-1 ring-stone-200">سيتم تجهيز الطلب للاستلام من الفرع، ولن يتم احتساب الشحن.</p>}</div>
        <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-stone-200"><h3 className="font-black">ملخص الطلب</h3><div className="mt-3 space-y-2 text-sm"><Row label="المجموع قبل الخصم" value={`${preview.subtotalBeforeDiscount.toFixed(2)} ريال`} /><Row label={appliedDiscount ? `خصم ${appliedDiscount.code}` : 'الخصم'} value={`-${preview.discountAmount.toFixed(2)} ريال`} /><Row label="الصافي الخاضع للضريبة" value={`${preview.taxableAmount.toFixed(2)} ريال`} /><Row label="ضريبة القيمة المضافة 15%" value={`${preview.vatAmount.toFixed(2)} ريال`} /><Row label={selectedShipping ? `الشحن - ${selectedShipping.company}` : 'الشحن'} value={preview.shippingAmount === 0 ? 'مجاني' : `${preview.shippingAmount.toFixed(2)} ريال`} /><div className="mt-3 flex items-center justify-between rounded-2xl bg-stone-950 px-4 py-3 text-white"><span>الإجمالي</span><strong className="text-xl">{preview.totalAmount.toFixed(2)} ريال</strong></div></div><div className="mt-3"><TabbyPromoWidget price={preview.totalAmount} source="cart" /></div></div>{message ? <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{message}</p> : null}</div><div className="border-t border-stone-200 bg-white p-4"><button onClick={startTabbyCheckout} disabled={saving || cart.length === 0} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-4 text-lg font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"><ShoppingBag size={20} /> {saving ? 'جاري تحويلك إلى تابي...' : 'الدفع عبر تابي'}</button><div className="mt-3 flex items-center justify-center gap-2 text-xs text-stone-500"><Truck size={16} /> شركة الشحن متعددة حسب المتوفر</div></div></aside></div> : null}
      <footer className="mx-auto max-w-7xl px-4 pb-10 text-center text-sm text-stone-600"><div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200"><p className="font-bold text-stone-900">{settings.store_name}</p><p className="mt-1">{settings.store_city} - الرقم الضريبي: {settings.vat_number}</p><nav className="mt-4 flex flex-wrap justify-center gap-3"><Link className="hover:text-emerald-700" href="/shipping-policy">سياسة الشحن</Link><Link className="hover:text-emerald-700" href="/refund-policy">الاسترجاع والاستبدال</Link><Link className="hover:text-emerald-700" href="/terms">الشروط والأحكام</Link><Link className="hover:text-emerald-700" href="/privacy">سياسة الخصوصية</Link><Link className="hover:text-emerald-700" href="/contact">تواصل معنا</Link></nav></div></footer>
    </main>
  );
}

function calculateCartOrder(cart: CartItem[], discount: DiscountCode | null, fulfillmentType: 'shipping' | 'pickup', selectedShipping: ShippingOption | null) {
  const subtotalBeforeDiscount = roundMoney(cart.reduce((sum, item) => sum + Number(item.product.price_before_vat || 0) * item.quantity, 0));
  const rawDiscount = discount ? (discount.type === 'percentage' ? subtotalBeforeDiscount * (Number(discount.value || 0) / 100) : Number(discount.value || 0)) : 0;
  const cappedDiscount = discount?.max_discount_amount ? Math.min(rawDiscount, Number(discount.max_discount_amount)) : rawDiscount;
  const discountAmount = roundMoney(Math.min(subtotalBeforeDiscount, Math.max(0, cappedDiscount)));
  const taxableAmount = roundMoney(subtotalBeforeDiscount - discountAmount);
  const vatAmount = roundMoney(taxableAmount * 0.15);
  const fallbackShipping = roundMoney(cart.length === 0 ? 0 : Math.max(...cart.map((item) => Number(item.product.shipping_amount || 0))));
  const shippingAmount = fulfillmentType === 'pickup' ? 0 : roundMoney(selectedShipping ? Number(selectedShipping.price || 0) : fallbackShipping);
  const totalAmount = roundMoney(taxableAmount + vatAmount + shippingAmount);
  return { subtotalBeforeDiscount, discountAmount, taxableAmount, vatAmount, shippingAmount, totalAmount };
}
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function isValidEmail(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3"><span className="text-stone-500">{label}</span><strong className="text-left">{value}</strong></div>; }
