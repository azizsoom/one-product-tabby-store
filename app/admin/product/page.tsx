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
  image_url: string | null;
  is_active: boolean;
};

export default function AdminProductPage() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProduct();
  }, []);

  async function loadProduct() {
    setLoading(true);
    const { data, error } = await db.from('products').select('*').limit(1).single();
    if (error) {
      setMessage('تعذر تحميل المنتج: ' + error.message);
    } else {
      setProduct(data);
    }
    setLoading(false);
  }

  async function uploadImage(file: File) {
    if (!product || !file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage('صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('حجم الصورة كبير. الحد الأقصى 5MB.');
      return;
    }

    setUploading(true);
    setMessage('');

    const extension = file.name.split('.').pop() || 'webp';
    const filePath = `products/${product.id}-${Date.now()}.${extension}`;

    const { error } = await db.storage
      .from('product-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      setUploading(false);
      setMessage('فشل رفع الصورة: ' + error.message);
      return;
    }

    const { data } = db.storage.from('product-images').getPublicUrl(filePath);
    setProduct({ ...product, image_url: data.publicUrl });
    setUploading(false);
    setMessage('تم رفع الصورة. اضغط حفظ التعديلات لاعتمادها.');
  }

  async function saveProduct() {
    if (!product) return;
    setSaving(true);
    setMessage('');

    const { error } = await db
      .from('products')
      .update({
        name: product.name,
        description: product.description,
        price_before_vat: Number(product.price_before_vat || 0),
        shipping_amount: Number(product.shipping_amount || 0),
        image_url: product.image_url,
        is_active: product.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id);

    setSaving(false);
    setMessage(error ? 'فشل الحفظ: ' + error.message : 'تم حفظ التعديلات بنجاح');
  }

  if (loading) {
    return <main className="min-h-screen p-6" dir="rtl">جاري التحميل...</main>;
  }

  if (!product) {
    return <main className="min-h-screen p-6" dir="rtl">لم يتم العثور على المنتج.</main>;
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin" className="text-sm text-emerald-700">الرجوع للوحة التحكم</Link>
        <h1 className="mt-4 text-3xl font-black">تعديل المنتج</h1>

        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <Label title="اسم المنتج">
            <input className="input" value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} />
          </Label>

          <Label title="الوصف">
            <textarea className="input min-h-28" value={product.description || ''} onChange={(e) => setProduct({ ...product, description: e.target.value })} />
          </Label>

          <div className="grid gap-4 md:grid-cols-2">
            <Label title="السعر قبل الضريبة">
              <input className="input" type="number" step="0.01" value={product.price_before_vat} onChange={(e) => setProduct({ ...product, price_before_vat: Number(e.target.value) })} />
            </Label>

            <Label title="قيمة الشحن">
              <input className="input" type="number" step="0.01" value={product.shipping_amount} onChange={(e) => setProduct({ ...product, shipping_amount: Number(e.target.value) })} />
            </Label>
          </div>

          <Label title="رفع صورة المنتج من الجهاز">
            <input className="input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
          </Label>

          <Label title="رابط صورة المنتج">
            <input className="input" value={product.image_url || ''} placeholder="https://..." onChange={(e) => setProduct({ ...product, image_url: e.target.value })} />
          </Label>

          {uploading ? <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm">جاري رفع الصورة...</p> : null}

          {product.image_url ? (
            <div className="mt-4 rounded-2xl bg-stone-100 p-4">
              <img src={product.image_url} alt={product.name} className="mx-auto max-h-72 object-contain" />
            </div>
          ) : null}

          <label className="mt-5 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={product.is_active} onChange={(e) => setProduct({ ...product, is_active: e.target.checked })} />
            المنتج مفعل
          </label>

          {message ? <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm">{message}</p> : null}

          <button onClick={saveProduct} disabled={saving || uploading} className="mt-6 w-full rounded-2xl bg-emerald-600 px-6 py-4 font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </main>
  );
}

function Label({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-sm font-bold text-stone-700">{title}</span>
      {children}
    </label>
  );
}
