import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const db = createClient(supabaseUrl, supabaseKey);

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const params = await searchParams;
  const orderId = params.order_id || '';
  let updateMessage = 'تم تأكيد الطلب بنجاح.';

  if (orderId) {
    const { error } = await db
      .from('orders')
      .update({
        payment_status: 'paid_test',
        order_status: 'confirmed',
      })
      .eq('id', orderId);

    if (error) {
      updateMessage = 'تم الدفع في تابي، لكن تعذر تحديث حالة الطلب تلقائيًا: ' + error.message;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 text-stone-950" dir="rtl">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-200">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700">✓</div>
        <h1 className="mt-6 text-3xl font-black">تم تأكيد الطلب</h1>
        <p className="mt-3 text-stone-600">{updateMessage}</p>
        {orderId ? (
          <div className="mt-6 rounded-2xl bg-stone-100 p-4 text-sm">
            <p className="font-bold">رقم الطلب</p>
            <p className="mt-1 break-all font-mono text-stone-700">{orderId}</p>
          </div>
        ) : null}
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Link href="/" className="rounded-2xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700">الرجوع للمتجر</Link>
          <Link href="/admin/orders" className="rounded-2xl bg-stone-950 px-5 py-3 font-bold text-white hover:bg-stone-800">عرض الطلبات</Link>
        </div>
      </section>
    </main>
  );
}
