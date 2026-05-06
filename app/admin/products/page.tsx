'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/db';

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

const emptyProduct = {
  name: '',
  description: '',
  price_before_vat: 0,
  shipping_amount: 0,
  stock_quantity: 0,
  image_url: '',
  is_active: true,
};

export default function ProductsAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [newProduct, setNewProduct] = useState(emptyProduct);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setLoading(true);
    const { data, error } = await db.from('products').select('*').order('created_at', { ascending: false });
    setMessage(error ? 'تعذر تحميل المنتجات: ' + error.message : '');
    setProducts((data || []).map((p: any) => ({ ...p, stock_quantity: Number(p.stock_quantity ?? 0) })) as Product[]);
    setLoading(false);
  }

  async function addProduct() {
    if (!newProduct.name.trim()) return setMessage('أدخل اسم المنتج.');
    if (Number(newProduct.price_before_vat) <= 0) return setMessage('أدخل سعر صحيح.');
    setSaving(true);
    const { error } = await db.from('products').insert({
      name: newProduct.name,
      description: newProduct.description,
      price_before_vat: Number(newProduct.price_before_vat || 0),
      shipping_amount: Number(newProduct.shipping_amount || 0),
      stock_quantity: Number(newProduct.stock_quantity || 0),
      image_url: newProduct.image_url || null,
      is_active: newProduct.is_active,
    });
    setSaving(false);
    if (error) return setMessage('فشل إضافة المنتج: ' + error.message);
    setNewProduct(emptyProduct);
    setMessage('تم إضافة المنتج.');
    loadProducts();
  }

  async function saveProduct(product: Product) {
    const { error } = await db.from('products').update({
      name: product.name,
      description: product.description,
      price_before_vat: Number(product.price_before_vat || 0),
      shipping_amount: Number(product.shipping_amount || 0),
      stock_quantity: Math.max(0, Number(product.stock_quantity || 0)),
      image_url: product.image_url,
      is_active: product.is_active,
      updated_at: new Date().toISOString(),
    }).eq('id', product.id);
    setMessage(error ? 'فشل حفظ المنتج: ' + error.message : 'تم حفظ المنتج.');
    if (!error) loadProducts();
  }

  function updateProduct(id: string, updates: Partial<Product>) {
    setProducts((items) => items.map((item) => item.id === id ? { ...item, ...updates } : item));
  }

  return (
    <main className="min-h-screen bg-stone-50 p-4 text-stone-950 md:p-6" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-sm text-emerald-700">الرجوع للوحة التحكم</Link>
        <h1 className="mt-4 text-3xl font-black">إدارة المنتجات</h1>
        <p className="mt-2 text-stone-600">كل خانة موضح فوقها وش تكتب فيها حتى تكون إضافة المنتج واضحة.</p>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200 md:p-6">
          <h2 className="text-xl font-black">إضافة منتج جديد</h2>
          <p className="mt-2 text-sm text-stone-500">املأ البيانات الأساسية للمنتج. أي حقل غير مطلوب تقدر تتركه فاضي إذا مكتوب في التوضيح.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Field label="اسم المنتج" help="اكتب الاسم الذي يظهر للعميل في بطاقة المنتج والسلة." value={newProduct.name} onChange={(v) => setNewProduct({ ...newProduct, name: v })} placeholder="مثال: حطب قرض أفريقي 10 كيلو" />
            <Field label="السعر قبل الضريبة" help="اكتب سعر الحبة الواحدة قبل ضريبة 15%. مثال: 39 أو 369." type="number" step="0.01" value={String(newProduct.price_before_vat)} onChange={(v) => setNewProduct({ ...newProduct, price_before_vat: Number(v) })} placeholder="0.00" />
            <Field label="الكمية المتوفرة" help="عدد القطع المتاحة للبيع. النظام يمنع طلب أكثر من هذا العدد." type="number" value={String(newProduct.stock_quantity)} onChange={(v) => setNewProduct({ ...newProduct, stock_quantity: Number(v) })} placeholder="100" />
            <Field label="قيمة الشحن" help="اكتب قيمة الشحن لهذا المنتج. إذا الشحن مجاني اكتب 0." type="number" step="0.01" value={String(newProduct.shipping_amount)} onChange={(v) => setNewProduct({ ...newProduct, shipping_amount: Number(v) })} placeholder="0.00" />
            <Field label="رابط صورة المنتج" help="ضع رابط صورة مباشر. إذا تركته فاضي يظهر المنتج بدون صورة." className="md:col-span-2" value={newProduct.image_url} onChange={(v) => setNewProduct({ ...newProduct, image_url: v })} placeholder="https://..." />
            <TextAreaField label="وصف المنتج" help="اكتب وصف مختصر أو مواصفات المنتج. يقدر يكون فاضي مؤقتًا." className="md:col-span-3" value={newProduct.description} onChange={(v) => setNewProduct({ ...newProduct, description: v })} placeholder="مثال: منتج عالي الجودة مناسب للاستخدام الخارجي..." />
          </div>
          <label className="mt-5 flex items-start gap-3 rounded-2xl bg-stone-50 p-4 text-sm ring-1 ring-stone-200">
            <input type="checkbox" className="mt-1" checked={newProduct.is_active} onChange={(e) => setNewProduct({ ...newProduct, is_active: e.target.checked })} />
            <span><strong>إظهار المنتج في المتجر</strong><br /><span className="text-stone-500">إذا أزلت التحديد، المنتج ينحفظ في لوحة التحكم لكن لا يظهر للعميل.</span></span>
          </label>
          <button onClick={addProduct} disabled={saving} className="mt-4 rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white disabled:opacity-50">إضافة المنتج</button>
        </section>

        {message ? <p className="mt-4 rounded-2xl bg-white p-4 text-sm ring-1 ring-stone-200">{message}</p> : null}

        <section className="mt-6 space-y-4">
          {loading ? <div className="rounded-3xl bg-white p-6">جاري التحميل...</div> : products.length === 0 ? <div className="rounded-3xl bg-white p-6 text-stone-600">لا توجد منتجات.</div> : products.map((product) => (
            <div key={product.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
              <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                <div>
                  <p className="mb-2 text-sm font-bold text-stone-700">معاينة الصورة</p>
                  <div className="flex h-40 items-center justify-center rounded-2xl bg-stone-100 p-3 ring-1 ring-stone-200">
                    {product.image_url ? <img src={product.image_url} alt={product.name} className="max-h-full max-w-full object-contain" /> : <span className="text-sm text-stone-500">لا توجد صورة</span>}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="اسم المنتج" help="يظهر للعميل في المتجر والسلة." value={product.name} onChange={(v) => updateProduct(product.id, { name: v })} />
                  <Field label="السعر قبل الضريبة" help="سعر الحبة الواحدة قبل ضريبة 15%." type="number" step="0.01" value={String(product.price_before_vat)} onChange={(v) => updateProduct(product.id, { price_before_vat: Number(v) })} />
                  <Field label="الكمية المتوفرة" help="المخزون المتاح للطلب." type="number" value={String(product.stock_quantity)} onChange={(v) => updateProduct(product.id, { stock_quantity: Number(v) })} />
                  <Field label="قيمة الشحن" help="اكتب 0 إذا الشحن مجاني." type="number" step="0.01" value={String(product.shipping_amount)} onChange={(v) => updateProduct(product.id, { shipping_amount: Number(v) })} />
                  <Field label="رابط صورة المنتج" help="رابط مباشر للصورة المعروضة في المتجر." className="md:col-span-2" value={product.image_url || ''} onChange={(v) => updateProduct(product.id, { image_url: v })} />
                  <TextAreaField label="وصف المنتج" help="وصف مختصر أو مواصفات، ويمكن تركه فاضي." className="md:col-span-3" value={product.description || ''} onChange={(v) => updateProduct(product.id, { description: v })} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-start gap-3 rounded-2xl bg-stone-50 p-4 text-sm ring-1 ring-stone-200">
                  <input type="checkbox" className="mt-1" checked={product.is_active} onChange={(e) => updateProduct(product.id, { is_active: e.target.checked })} />
                  <span><strong>مفعل في المتجر</strong><br /><span className="text-stone-500">إذا غير مفعل، لن يظهر للعميل.</span></span>
                </label>
                <button onClick={() => saveProduct(product)} className="rounded-2xl bg-stone-950 px-6 py-3 font-bold text-white">حفظ المنتج</button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

function Field({ label, help, value, onChange, placeholder = '', type = 'text', step, className = '' }: { label: string; help: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; step?: string; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-sm font-black text-stone-800">{label}</span>
      <span className="mb-2 block text-xs leading-5 text-stone-500">{help}</span>
      <input className="input" type={type} step={step} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextAreaField({ label, help, value, onChange, placeholder = '', className = '' }: { label: string; help: string; value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-sm font-black text-stone-800">{label}</span>
      <span className="mb-2 block text-xs leading-5 text-stone-500">{help}</span>
      <textarea className="input min-h-24" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
