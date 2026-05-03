import Link from 'next/link';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-6 leading-8 shadow-sm ring-1 ring-stone-200 md:p-10">
        <Link href="/" className="text-sm font-bold text-emerald-700">الرجوع للمتجر</Link>
        <h1 className="mt-4 text-3xl font-black">تواصل معنا</h1>
        <div className="mt-6 space-y-5 text-stone-700">
          <p>يسعدنا استقبال استفساراتكم وملاحظاتكم بخصوص الطلبات أو المنتجات أو خدمات الشحن والاسترجاع.</p>
          <p><strong>اسم المتجر:</strong> شركة المطارة</p>
          <p><strong>البريد الإلكتروني:</strong> az@kco.sa</p>
          <p><strong>رقم الجوال أو الواتساب:</strong> 0555868221</p>
          <p><strong>المدينة:</strong> الرياض، المملكة العربية السعودية</p>
          <p><strong>الرقم الضريبي:</strong> 300339747477747</p>
          <p>للاستفسار عن طلب، يرجى تزويدنا برقم الطلب واسم العميل ورقم الجوال المسجل في الطلب لتسهيل خدمتك.</p>
        </div>
      </article>
    </main>
  );
}
