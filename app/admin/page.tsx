import Link from 'next/link';

export default function AdminHome() {
  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-black">لوحة التحكم</h1>
            <p className="mt-2 text-stone-600">إدارة المنتج والطلبات قبل ربط تابي.</p>
          </div>

          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl bg-emerald-600 px-6 py-3 text-center font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            فتح المتجر للتجربة
          </a>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link href="/admin/product" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50">
            <h2 className="text-xl font-bold">تعديل المنتج</h2>
            <p className="mt-2 text-sm text-stone-600">تعديل الاسم، السعر، الوصف، ورابط الصورة.</p>
          </Link>

          <Link href="/admin/orders" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50">
            <h2 className="text-xl font-bold">الطلبات</h2>
            <p className="mt-2 text-sm text-stone-600">عرض الطلبات التجريبية ومراجعة الحسابات.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
