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
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-sm text-emerald-700">الرجوع للوحة التحكم</Link>
        <h1 className="mt-4 text-3xl font-black">إدارة المنتجات</h1>
        <p className="mt-2 text-stone-600">إضافة أكثر من منتج وتعديل السعر والكمية والصورة وحالة الظهور.</p>

        <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <h2 className="text-xl font-black">إضافة منتج جديد</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input className="input" placeholder="اسم المنتج" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
            <input className="input" type="number" step="0.01" placeholder="السعر قبل الضريبة" value={newProduct.price_before_vat} onChange={(e) => setNewProduct({ ...newProduct, price_before_vat: Number(e.target.value) })} />
            <input className="input" type="number" placeholder="الكمية المتوفرة" value={newProduct.stock_quantity} onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: Number(e.target.value) })} />
            <input className="input" type="number" step="0.01" placeholder="قيمة الشحن" value={newProduct.shipping_amount} onChange={(e) => setNewProduct({ ...newProduct, shipping_amount: Number(e.target.value) })} />
            <input className="input md:col-span-2" placeholder="رابط الصورة" value={newProduct.image_url} onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })} />
            <textarea className="input min-h-24 md:col-span-3" placeholder="الوصف" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} />
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={newProduct.is_active} onChange={(e) => setNewProduct({ ...newProduct, is_active: e.target.checked })} /> المنتج مفعل</label>
          <button onClick={addProduct} disabled={saving} className="mt-4 rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white disabled:opacity-50">إضافة المنتج</button>
        </section>

        {message ? <p className="mt-4 rounded-2xl bg-white p-4 text-sm ring-1 ring-stone-200">{message}</p> : null}

        <section className="mt-6 space-y-4">
          {loading ? <div className="rounded-3xl bg-white p-6">جاري التحميل...</div> : products.length === 0 ? <div className="rounded-3xl bg-white p-6 text-stone-600">لا توجد منتجات.</div> : products.map((product) => (
            <div key={product.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
              <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                <div className="flex h-40 items-center justify-center rounded-2xl bg-stone-100 p-3">
                  {product.image_url ? <img src={product.image_url} alt={product.name} className="max-h-full max-w-full object-contain" /> : <span className="text-sm text-stone-500">لا توجد صورة</span>}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input className="input" value={product.name} onChange={(e) => updateProduct(product.id, { name: e.target.value })} />
                  <input className="input" type="number" step="0.01" value={product.price_before_vat} onChange={(e) => updateProduct(product.id, { price_before_vat: Number(e.target.value) })} />
                  <input className="input" type="number" value={product.stock_quantity} onChange={(e) => updateProduct(product.id, { stock_quantity: Number(e.target.value) })} />
                  <input className="input" type="number" step="0.01" value={product.shipping_amount} onChange={(e) => updateProduct(product.id, { shipping_amount: Number(e.target.value) })} />
                  <input className="input md:col-span-2" value={product.image_url || ''} placeholder="رابط الصورة" onChange={(e) => updateProduct(product.id, { image_url: e.target.value })} />
                  <textarea className="input min-h-24 md:col-span-3" value={product.description || ''} onChange={(e) => updateProduct(product.id, { description: e.target.value })} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={product.is_active} onChange={(e) => updateProduct(product.id, { is_active: e.target.checked })} /> مفعل في المتجر</label>
                <button onClick={() => saveProduct(product)} className="rounded-2xl bg-stone-950 px-6 py-3 font-bold text-white">حفظ المنتج</button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
