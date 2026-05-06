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
  admin_notes: string | null;
  created_at: string;
};

type CartItem = { name: string; quantity: number; unit_price_before_vat: number };
type ShippingInfo = { fulfillment_type?: string; city?: string; district?: string; address?: string; notes?: string };

export default async function CustomerOrderPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const params = await searchParams;
  const orderId = params.order_id || '';

  if (!orderId) return <OrderShell title="لم يتم العثور على الطلب" message="رقم الطلب غير موجود في الرابط." />;

  const { data: order, error } = await db.from('orders').select('*').eq('id', orderId).single<Order>();
  if (error || !order) return <OrderShell title="لم يتم العثور على الطلب" message="تعذر جلب بيانات الطلب. يرجى التواصل معنا وتزويدنا برقم الطلب إن وجد." />;

  const details = getOrderDetails(order);
  const whatsappText = encodeURIComponent(`السلام عليكم، عندي استفسار عن الطلب رقم ${order.id}`);
  const whatsappUrl = `https://wa.me/966555868221?text=${whatsappText}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-stone-50 p-4 text-stone-950 md:p-6" dir="rtl">
      <section className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-stone-200">
        <div className="bg-stone-950 p-6 text-center text-white md:p-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-4xl text-white">✓</div>
          <h1 className="mt-6 text-3xl font-black md:text-4xl">تم استلام طلبك بنجاح</h1>
          <p className="mt-3 text-stone-200">احتفظ برقم الطلب لمتابعة حالة الطلب أو التواصل معنا.</p>
        </div>

        <div className="p-5 md:p-8">
          <div className="rounded-3xl bg-stone-50 p-4 ring-1 ring-stone-200">
            <p className="font-bold text-stone-500">رقم الطلب</p>
            <p className="mt-1 break-all font-mono text-sm font-black text-stone-900 md:text-base">{order.id}</p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Info label="اسم العميل" value={order.customer_name || '-'} />
            <Info label="رقم الجوال" value={order.customer_mobile || '-'} />
            <Info label="تاريخ الطلب" value={new Date(order.created_at).toLocaleString('ar-SA')} />
            <Info label="حالة الدفع" value={translatePaymentStatus(order.payment_status)} />
            <Info label="حالة الطلب" value={translateOrderStatus(order.order_status)} />
            <Info label="طريقة الاستلام" value={details.shipping.fulfillment_type === 'pickup' ? 'استلام من الفرع' : 'شحن'} />
          </div>

          <div className="mt-6 rounded-3xl border border-stone-200 p-5">
            <h2 className="text-xl font-black">المنتجات</h2>
            <div className="mt-4 space-y-3">
              {details.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200">
                  <div>
                    <p className="font-black">{item.name}</p>
                    <p className="mt-1 text-sm text-stone-500">الكمية: {item.quantity}</p>
                  </div>
                  <p className="font-black">{money(Number(item.unit_price_before_vat || 0) * Number(item.quantity || 0))}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-stone-200 p-5">
              <h2 className="text-xl font-black">الشحن والاستلام</h2>
              {details.shipping.fulfillment_type === 'pickup' ? (
                <p className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">تم اختيار استلام الطلب من الفرع. سيتم التواصل معك عند جاهزية الطلب.</p>
              ) : (
                <div className="mt-4 space-y-3 text-sm">
                  <Row label="المدينة" value={details.shipping.city || '-'} />
                  <Row label="الحي" value={details.shipping.district || '-'} />
                  <Row label="العنوان" value={details.shipping.address || '-'} />
                  <Row label="ملاحظات" value={details.shipping.notes || '-'} />
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-stone-200 p-5">
              <h2 className="text-xl font-black">ملخص المبلغ</h2>
              <div className="mt-4 space-y-3 text-sm">
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
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <Link href="/" className="rounded-2xl bg-emerald-600 px-6 py-4 text-center font-bold text-white hover:bg-emerald-700">الرجوع للمتجر</Link>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="rounded-2xl bg-stone-950 px-6 py-4 text-center font-bold text-white hover:bg-stone-800">التواصل عبر واتساب</a>
          </div>
        </div>
      </section>
    </main>
  );
}

function getOrderDetails(order: Order): { items: CartItem[]; shipping: ShippingInfo } {
  try {
    const parsed = order.admin_notes ? JSON.parse(order.admin_notes) : null;
    const items = Array.isArray(parsed?.cart_items) && parsed.cart_items.length > 0 ? parsed.cart_items : null;
    return {
      items: items || [{ name: order.product_name, quantity: Number(order.quantity || 1), unit_price_before_vat: Number(order.subtotal_before_discount || 0) / Math.max(1, Number(order.quantity || 1)) }],
      shipping: parsed?.shipping_info || {},
    };
  } catch {
    return {
      items: [{ name: order.product_name, quantity: Number(order.quantity || 1), unit_price_before_vat: Number(order.subtotal_before_discount || 0) / Math.max(1, Number(order.quantity || 1)) }],
      shipping: {},
    };
  }
}

function OrderShell({ title, message }: { title: string; message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6 text-stone-950" dir="rtl"><section className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-200"><h1 className="text-3xl font-black">{title}</h1><p className="mt-3 text-stone-600">{message}</p><Link href="/" className="mt-6 inline-block rounded-2xl bg-stone-950 px-6 py-3 font-bold text-white hover:bg-stone-800">الرجوع للمتجر</Link></section></main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200"><p className="text-xs font-bold text-stone-500">{label}</p><p className="mt-1 font-bold text-stone-900">{value}</p></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4"><span className="text-stone-500">{label}</span><strong className="text-left">{value}</strong></div>; }
function money(value: number) { return Number(value || 0).toFixed(2) + ' ريال'; }
function translatePaymentStatus(status: string) { const map: Record<string, string> = { pending: 'بانتظار الدفع', paid_test: 'مدفوع - تجريبي', paid: 'مدفوع', captured: 'مدفوع', cancelled: 'ملغي', failed: 'فشل الدفع' }; return map[status] || status; }
function translateOrderStatus(status: string) { const map: Record<string, string> = { new: 'جديد', confirmed: 'مؤكد', preparing: 'قيد التجهيز', shipped: 'تم الشحن', delivered: 'تم التسليم', cancelled: 'ملغي', payment_failed: 'فشل الدفع' }; return map[status] || status; }
