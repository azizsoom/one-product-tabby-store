import Link from 'next/link';

export default function ShippingPolicyPage() {
  return (
    <PolicyPage title="سياسة الشحن والتوصيل">
      <p>نحرص في متجر شركة المطارة على تجهيز وشحن الطلبات بأسرع وقت ممكن بعد تأكيد الطلب.</p>

      <h2>مدة الشحن</h2>
      <p>يتم توصيل الطلبات خلال مدة تتراوح من 3 أيام عمل إلى 7 أيام عمل، وقد تختلف المدة حسب المدينة أو المنطقة أو ظروف شركة الشحن.</p>

      <h2>شركات الشحن</h2>
      <p>يتم الشحن عبر شركات شحن متعددة، ويتم اختيار شركة الشحن حسب المتوفر والأنسب لموقع العميل في وقت تنفيذ الطلب.</p>

      <h2>رسوم الشحن</h2>
      <p>الشحن مجاني لجميع الطلبات، ما لم يتم توضيح خلاف ذلك أثناء عملية الشراء.</p>

      <h2>تتبع الشحنة</h2>
      <p>عند توفر رقم تتبع للشحنة، سيتم تزويد العميل به عبر وسيلة التواصل المسجلة في الطلب.</p>

      <h2>ملاحظات مهمة</h2>
      <p>أيام العمل لا تشمل أيام الجمعة أو الإجازات الرسمية. وقد تتأخر بعض الشحنات لأسباب خارجة عن إرادتنا مثل ظروف شركات الشحن أو العنوان غير الواضح أو عدم تجاوب العميل مع شركة التوصيل. يجب على العميل التأكد من صحة رقم الجوال والعنوان قبل تأكيد الطلب.</p>
    </PolicyPage>
  );
}

function PolicyPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-6 leading-8 shadow-sm ring-1 ring-stone-200 md:p-10">
        <Link href="/" className="text-sm font-bold text-emerald-700">الرجوع للمتجر</Link>
        <h1 className="mt-4 text-3xl font-black">{title}</h1>
        <div className="mt-6 space-y-5 text-stone-700">{children}</div>
      </article>
    </main>
  );
}
