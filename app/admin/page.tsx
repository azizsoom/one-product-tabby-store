import Link from 'next/link';
import { Boxes, FileText, Percent, Settings, ShoppingBag, Store, Truck, WandSparkles, GitBranch } from 'lucide-react';
import { appVersion } from '../../lib/appVersion';

const primaryCards = [
  { href: '/admin/products', title: 'إدارة المنتجات', desc: 'إضافة وتعديل المنتجات والأسعار والكميات والصور.', icon: Boxes },
  { href: '/admin/orders', title: 'الطلبات', desc: 'متابعة الطلبات وتحديث الحالة والشحن والتتبع.', icon: ShoppingBag },
  { href: '/admin/settings', title: 'إعدادات المتجر وتابي', desc: 'اللوقو والبيانات ومفاتيح الربط مع تابي.', icon: Settings },
];

const secondaryCards = [
  { href: '/admin/product', title: 'تعديل المنتج الأول', desc: 'تعديل سريع للمنتج الحالي.', icon: Store },
  { href: '/admin/discounts', title: 'أكواد الخصم', desc: 'إدارة الخصومات والتفعيل.', icon: Percent },
  { href: '/admin/content', title: 'محتوى الصفحة', desc: 'تعديل عناوين ونصوص الواجهة.', icon: WandSparkles },
  { href: '/admin/policies', title: 'السياسات', desc: 'الشحن والاسترجاع والخصوصية والشروط.', icon: FileText },
];

export default function AdminHome() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-100 to-stone-50 p-4 text-stone-950 md:p-6" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2rem] bg-stone-950 p-6 text-white shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-emerald-100">
                <Truck size={18} /> لوحة إدارة المتجر
              </div>
              <h1 className="text-3xl font-black md:text-5xl">لوحة التحكم</h1>
              <p className="mt-3 max-w-2xl leading-7 text-stone-200">إدارة المنتجات والطلبات والمحتوى ومفاتيح تابي من مكان واحد.</p>
            </div>
            <a href="/" target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-emerald-600 px-6 py-4 text-center font-black text-white shadow-sm hover:bg-emerald-700">
              فتح المتجر للتجربة
            </a>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-stone-200 md:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-950 text-white"><GitBranch size={22} /></div>
              <h2 className="text-2xl font-black">إصدار النظام</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{appVersion.title}</p>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><p className="text-stone-500">رقم الإصدار</p><p className="mt-1 text-xl font-black">v{appVersion.version}</p></div>
              <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><p className="text-stone-500">رقم التحديث</p><p className="mt-1 text-xl font-black">#{appVersion.updateNumber}</p></div>
              <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><p className="text-stone-500">آخر تحديث</p><p className="mt-1 text-xl font-black">{appVersion.updatedAt}</p></div>
            </div>
          </div>
          <div className="mt-5 rounded-3xl bg-stone-50 p-4 ring-1 ring-stone-200">
            <p className="text-sm font-black text-stone-700">ملخص التغييرات</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {appVersion.changes.map((change) => <div key={change} className="rounded-2xl bg-white px-4 py-3 text-sm text-stone-700 ring-1 ring-stone-200">{change}</div>)}
            </div>
            <p className="mt-3 text-xs text-stone-500">نسخة الحفظ: {appVersion.backupBranch}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {primaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href} className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-md">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Icon size={26} /></div>
                <h2 className="text-2xl font-black">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">{card.desc}</p>
              </Link>
            );
          })}
        </section>

        <section className="mt-6 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-stone-200 md:p-6">
          <h2 className="text-xl font-black">أدوات إضافية</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {secondaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href} className="rounded-3xl bg-stone-50 p-4 ring-1 ring-stone-200 transition hover:bg-white hover:shadow-sm">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-stone-700 ring-1 ring-stone-200"><Icon size={20} /></div>
                  <h3 className="font-black">{card.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-stone-600">{card.desc}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
