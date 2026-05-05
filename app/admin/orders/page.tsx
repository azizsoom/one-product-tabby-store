'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/db';

type Order = {
  id: string;
  customer_name: string | null;
  customer_mobile: string | null;
  customer_email: string | null;
  product_name: string;
  quantity: number;
  subtotal_before_discount: number;
  discount_amount: number;
  taxable_amount: number;
  vat_amount: number;
  shipping_amount: number;
  total_amount: number;
  payment_status: string;
  order_status: string;
  tabby_payment_id: string | null;
  shipping_company?: string | null;
  tracking_number?: string | null;
  admin_notes?: string | null;
  created_at: string;
};

type CartDetail = {
  product_id?: string;
  name: string;
  quantity: number;
  unit_price_before_vat: number;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [orderFilter, setOrderFilter] = useState('all');

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    const { data, error } = await db.from('orders').select('*').order('created_at', { ascending: false });
    setMessage(error ? 'تعذر تحميل الطلبات: ' + error.message : '');
    setOrders((data || []) as Order[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      const details = getCartDetails(o).map((item) => item.name).join(' ');
      const matchesSearch = !q || [o.id, o.customer_name, o.customer_mobile, o.customer_email, o.product_name, o.tracking_number, details].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesPayment = paymentFilter === 'all' || o.payment_status === paymentFilter;
      const matchesOrder = orderFilter === 'all' || o.order_status === orderFilter;
      return matchesSearch && matchesPayment && matchesOrder;
    });
  }, [orders, search, paymentFilter, orderFilter]);

  const stats = useMemo(() => {
    const paid = orders.filter((o) => ['paid_test', 'paid', 'captured'].includes(o.payment_status));
    return {
      count: orders.length,
      paidCount: paid.length,
      pendingCount: orders.filter((o) => o.payment_status === 'pending').length,
      total: paid.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
    };
  }, [orders]);

  async function updateOrder(id: string, updates: Partial<Order>) {
    const { error } = await db.from('orders').update(updates).eq('id', id);
    if (error) setMessage('فشل تحديث الطلب: ' + error.message);
    else loadOrders();
  }

  function exportCsv() {
    const header = ['order_id','created_at','customer_name','mobile','email','items','payment_status','order_status','total','shipping_company','tracking_number'];
    const rows = filtered.map((o) => [o.id, o.created_at, o.customer_name || '', o.customer_mobile || '', o.customer_email || '', getCartDetails(o).map((i) => `${i.name} x ${i.quantity}`).join(' | '), o.payment_status, o.order_status, o.total_amount, o.shipping_company || '', o.tracking_number || '']);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-stone-50 p-4 text-stone-950 md:p-6" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-sm text-emerald-700">الرجوع للوحة التحكم</Link>
        <div className="mt-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-black">الطلبات</h1>
            <p className="mt-2 text-stone-600">تفاصيل المنتجات، حالة الطلب، وبيانات الشحن والتتبع.</p>
          </div>
          <div className="flex gap-2"><button onClick={exportCsv} className="rounded-2xl bg-white px-5 py-3 font-bold ring-1 ring-stone-200">تصدير CSV</button><button onClick={loadOrders} className="rounded-2xl bg-stone-950 px-5 py-3 font-bold text-white">تحديث</button></div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Stat title="عدد الطلبات" value={stats.count.toString()} />
          <Stat title="طلبات مدفوعة" value={stats.paidCount.toString()} />
          <Stat title="بانتظار الدفع" value={stats.pendingCount.toString()} />
          <Stat title="إجمالي المدفوع" value={money(stats.total)} />
        </div>

        <div className="mt-6 grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-stone-200 md:grid-cols-3">
          <input className="input" placeholder="بحث برقم الطلب أو الجوال أو المنتج" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}><option value="all">كل حالات الدفع</option><option value="pending">بانتظار الدفع</option><option value="paid_test">مدفوع - تجريبي</option><option value="cancelled">ملغي</option><option value="failed">فشل الدفع</option></select>
          <select className="input" value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}><option value="all">كل حالات الطلب</option><option value="new">جديد</option><option value="confirmed">مؤكد</option><option value="preparing">قيد التجهيز</option><option value="shipped">تم الشحن</option><option value="delivered">تم التسليم</option><option value="cancelled">ملغي</option></select>
        </div>

        {message ? <p className="mt-4 rounded-2xl bg-white p-4 text-sm ring-1 ring-stone-200">{message}</p> : null}

        <div className="mt-6 space-y-4">
          {loading ? <div className="rounded-3xl bg-white p-6">جاري التحميل...</div> : filtered.length === 0 ? <div className="rounded-3xl bg-white p-6 text-stone-600">لا توجد طلبات مطابقة.</div> : filtered.map((order) => {
            const details = getCartDetails(order);
            return (
              <article key={order.id} className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-stone-200">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <p className="text-xs text-stone-500">{new Date(order.created_at).toLocaleString('ar-SA')}</p>
                    <h2 className="mt-1 text-xl font-black">طلب #{shortId(order.id)}</h2>
                    <p className="mt-1 text-sm text-stone-600">{order.customer_name || '-'} · {order.customer_mobile || '-'} · {order.customer_email || '-'}</p>
                  </div>
                  <div className="text-right md:text-left">
                    <p className="text-sm text-stone-500">الإجمالي</p>
                    <p className="text-2xl font-black">{money(order.total_amount)}</p>
                    <p className="mt-1 rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">{order.payment_status}</p>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl bg-stone-50 p-4">
                  <h3 className="font-black">تفاصيل المنتجات</h3>
                  <div className="mt-3 grid gap-2">
                    {details.map((item, idx) => (
                      <div key={`${order.id}-${idx}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
                        <div>
                          <p className="font-bold">{item.name}</p>
                          <p className="text-xs text-stone-500">الكمية: {item.quantity}</p>
                        </div>
                        <p className="font-black">{money(Number(item.unit_price_before_vat || 0) * Number(item.quantity || 0))}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <label><span className="mb-2 block text-xs font-bold text-stone-500">حالة الطلب</span><select className="input" value={order.order_status} onChange={(e) => updateOrder(order.id, { order_status: e.target.value })}><option value="new">جديد</option><option value="confirmed">مؤكد</option><option value="preparing">قيد التجهيز</option><option value="shipped">تم الشحن</option><option value="delivered">تم التسليم</option><option value="cancelled">ملغي</option></select></label>
                  <label><span className="mb-2 block text-xs font-bold text-stone-500">شركة الشحن</span><input className="input" defaultValue={order.shipping_company || ''} onBlur={(e) => updateOrder(order.id, { shipping_company: e.target.value })} /></label>
                  <label><span className="mb-2 block text-xs font-bold text-stone-500">رقم التتبع</span><input className="input" defaultValue={order.tracking_number || ''} onBlur={(e) => updateOrder(order.id, { tracking_number: e.target.value })} /></label>
                  <div className="flex items-end gap-2"><a target="_blank" className="rounded-2xl bg-emerald-600 px-4 py-3 text-center font-bold text-white" href={`/order?order_id=${order.id}`}>صفحة العميل</a><button onClick={() => navigator.clipboard.writeText(order.id)} className="rounded-2xl bg-stone-950 px-4 py-3 font-bold text-white">نسخ</button></div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function getCartDetails(order: Order): CartDetail[] {
  try {
    const parsed = order.admin_notes ? JSON.parse(order.admin_notes) : null;
    if (Array.isArray(parsed?.cart_items) && parsed.cart_items.length > 0) return parsed.cart_items;
  } catch {}
  return [{ name: order.product_name, quantity: Number(order.quantity || 1), unit_price_before_vat: Number(order.subtotal_before_discount || 0) / Math.max(1, Number(order.quantity || 1)) }];
}

function Stat({ title, value }: { title: string; value: string }) { return <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200"><p className="text-sm text-stone-500">{title}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function money(value: number) { return Number(value || 0).toFixed(2) + ' ريال'; }
function shortId(id: string) { return id.slice(0, 8); }
