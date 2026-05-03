import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const db = createClient(supabaseUrl, supabaseKey);

type Order = {
  id: string;
  customer_name: string | null;
  customer_mobile: string | null;
  customer_email: string | null;
  product_name: string;
  quantity: number;
  subtotal_before_discount: number;
  discount_code: string | null;
  discount_amount: number;
  taxable_amount: number;
  vat_amount: number;
  shipping_amount: number;
  total_amount: number;
  payment_status: string;
  order_status: string;
  created_at: string;
};

export default async function CustomerOrderPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const params = await searchParams;
  const orderId = params.order_id || '';

  if (!orderId) {
    return <OrderShell title="لم يتم العثور على الطلب" message="رقم الطلب غير موجود في الرابط." />;
  }

  const { data: order, error } = await db
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single<Order>();

  if (error || !order) {
    return <OrderShell title="لم يتم العثور على الطلب" message="تعذر جلب بيانات الطلب. يرجى التواصل معنا وتزويدنا برقم الطلب إن وجد." />;
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200 md:p-10">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700">✓</div>
          <h1 className="mt-6 text-3xl font-black">تم استلام طلبك بنجاح</h1>
          <p className="mt-3 text-stone-600">احتفظ برقم الطلب لمتابعة حالة الطلب عند الحاجة.</p>
        </div>

        <div className="mt-8 rounded-2xl bg-stone-100 p-4 text-sm">
          <p className="font-bold">رقم الطلب</p>
          <p className="mt-1 break-all font-mono text-stone-700">{order.id}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Info label="اسم العميل" value={order.customer_name || '-'} />
          <Info label="رقم الجوال" value={order.customer_mobile || '-'} />
          <Info label="البريد الإلكتروني" value={order.customer_email || '-'} />
          <Info label="تاريخ الطلب" value={new Date(order.created_at).toLocaleString('ar-SA')} />
          <Info label="حالة الدفع" value={translatePaymentStatus(order.payment_status)} />
          <Info label="حالة الطلب" value={translateOrderStatus(order.order_status)} />
        </div>

        <div className="mt-8 rounded-3xl border border-stone-200 p-5">
          <h2 className="text-xl font-black">ملخص الطلب</h2>
          <div className="mt-4 space-y-3 text-sm">
            <Row label="المنتج" value={`${order.product_name} × ${order.quantity}`} />
            <Row label="السعر قبل الخصم" value={money(order.subtotal_before_discount)} />
            <Row label="كود الخصم" value={order.discount_code || '-'} />
            <Row label="الخصم" value={`-${money(order.discount_amount)}`} />
            <Row label="الصافي الخاضع للضريبة" value={money(order.taxable_amount)} />
            <Row label="ضريبة القيمة المضافة 15%" value={money(order.vat_amount)} />
            <Row label="الشحن" value={Number(order.shipping_amount) === 0 ? 'مجاني' : money(order.shipping_amount)} />
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-stone-950 px-5 py-4 text-white">
              <span>الإجمالي</span>
              <strong className="text-2xl">{money(order.total_amount)}</strong>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="inline-block rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700">الرجوع للمتجر</Link>
        </div>
      </section>
    </main>
  );
}

function OrderShell({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 text-stone-950" dir="rtl">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-200">
        <h1 className="text-3xl font-black">{title}</h1>
        <p className="mt-3 text-stone-600">{message}</p>
        <Link href="/" className="mt-6 inline-block rounded-2xl bg-stone-950 px-6 py-3 font-bold text-white hover:bg-stone-800">الرجوع للمتجر</Link>
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-4">
      <p className="text-xs font-bold text-stone-500">{label}</p>
      <p className="mt-1 font-bold text-stone-900">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-stone-500">{label}</span>
      <strong className="text-left">{value}</strong>
    </div>
  );
}

function money(value: number) {
  return Number(value || 0).toFixed(2) + ' ريال';
}

function translatePaymentStatus(status: string) {
  const map: Record<string, string> = {
    pending: 'بانتظار الدفع',
    paid_test: 'مدفوع - تجريبي',
    cancelled: 'ملغي',
    failed: 'فشل الدفع',
  };
  return map[status] || status;
}

function translateOrderStatus(status: string) {
  const map: Record<string, string> = {
    new: 'جديد',
    confirmed: 'مؤكد',
    cancelled: 'ملغي',
    payment_failed: 'فشل الدفع',
  };
  return map[status] || status;
}
