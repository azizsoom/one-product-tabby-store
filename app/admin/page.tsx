import Link from 'next/link';

const cards = [
  { href: '/admin/product', title: 'تعديل المنتج', desc: 'تعديل الاسم، السعر، الوصف، الشحن، والصورة.' },
  { href: '/admin/orders', title: 'الطلبات', desc: 'بحث، فلترة، تحديث الحالة، وإدارة التتبع.' },
  { href: '/admin/discounts', title: 'أكواد الخصم', desc: 'إضافة وتعطيل أكواد الخصم ونوعها وحدودها.' },
  { href: '/admin/content', title: 'محتوى الصفحة', desc: 'تعديل عناوين الصفحة والمميزات ونصوص الواجهة.' },
  { href: '/admin/policies', title: 'السياسات', desc: 'إدارة نصوص الشحن والاسترجاع والخصوصية والشروط.' },
  { href: '/admin/settings', title: 'إعدادات المتجر', desc: 'بيانات الشركة والتواصل والرقم الضريبي.' },
];

export default function AdminHome() {
  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-black">لوحة التحكم</h1>
            <p className="mt-2 text-stone-600">إدارة المتجر والطلبات والمحتوى قبل وبعد ربط تابي.</p>
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

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.href} href={card.href} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200 hover:bg-stone-50">
              <h2 className="text-xl font-bold">{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{card.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
