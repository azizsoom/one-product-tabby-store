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
      const matchesSearch = !q || [o.id, o.customer_name, o.customer_mobile, o.customer_email, o.product_name, o.tracking_number].some((v) => String(v || '').toLowerCase().includes(q));
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
    const header = ['order_id','created_at','customer_name','mobile','email','product','payment_status','order_status','total','shipping_company','tracking_number'];
    const rows = filtered.map((o) => [o.id, o.created_at, o.customer_name || '', o.customer_mobile || '', o.customer_email || '', o.product_name, o.payment_status, o.order_status, o.total_amount, o.shipping_company || '', o.tracking_number || '']);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-sm text-emerald-700">الرجوع للوحة التحكم</Link>
        <div className="mt-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-black">الطلبات</h1>
            <p className="mt-2 text-stone-600">بحث، فلترة، تحديث حالة الطلب، وإضافة بيانات الشحن.</p>
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
          <input className="input" placeholder="بحث برقم الطلب أو الجوال أو العميل" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}><option value="all">كل حالات الدفع</option><option value="pending">بانتظار الدفع</option><option value="paid_test">مدفوع - تجريبي</option><option value="cancelled">ملغي</option><option value="failed">فشل الدفع</option></select>
          <select className="input" value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)}><option value="all">كل حالات الطلب</option><option value="new">جديد</option><option value="confirmed">مؤكد</option><option value="preparing">قيد التجهيز</option><option value="shipped">تم الشحن</option><option value="delivered">تم التسليم</option><option value="cancelled">ملغي</option></select>
        </div>

        {message ? <p className="mt-4 rounded-2xl bg-white p-4 text-sm ring-1 ring-stone-200">{message}</p> : null}

        <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200">
          {loading ? <div className="p-6">جاري التحميل...</div> : filtered.length === 0 ? <div className="p-6 text-stone-600">لا توجد طلبات مطابقة.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-sm">
                <thead className="bg-stone-100 text-stone-600"><tr><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">العميل</th><th className="p-3 text-right">الجوال</th><th className="p-3 text-right">الإجمالي</th><th className="p-3 text-right">الدفع</th><th className="p-3 text-right">حالة الطلب</th><th className="p-3 text-right">شركة الشحن</th><th className="p-3 text-right">رقم التتبع</th><th className="p-3 text-right">روابط</th></tr></thead>
                <tbody>{filtered.map((order) => <tr key={order.id} className="border-t border-stone-100 align-top"><td className="p-3">{new Date(order.created_at).toLocaleString('ar-SA')}</td><td className="p-3 font-bold">{order.customer_name || '-'}</td><td className="p-3">{order.customer_mobile || '-'}</td><td className="p-3 font-black">{money(order.total_amount)}</td><td className="p-3">{order.payment_status}</td><td className="p-3"><select className="input min-w-40" value={order.order_status} onChange={(e) => updateOrder(order.id, { order_status: e.target.value })}><option value="new">جديد</option><option value="confirmed">مؤكد</option><option value="preparing">قيد التجهيز</option><option value="shipped">تم الشحن</option><option value="delivered">تم التسليم</option><option value="cancelled">ملغي</option></select></td><td className="p-3"><input className="input min-w-40" defaultValue={order.shipping_company || ''} onBlur={(e) => updateOrder(order.id, { shipping_company: e.target.value })} /></td><td className="p-3"><input className="input min-w-40" defaultValue={order.tracking_number || ''} onBlur={(e) => updateOrder(order.id, { tracking_number: e.target.value })} /></td><td className="p-3"><div className="flex gap-2"><a target="_blank" className="rounded-xl bg-emerald-600 px-3 py-2 text-white" href={`/order?order_id=${order.id}`}>صفحة العميل</a><button onClick={() => navigator.clipboard.writeText(order.id)} className="rounded-xl bg-stone-950 px-3 py-2 text-white">نسخ الرقم</button></div></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) { return <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200"><p className="text-sm text-stone-500">{title}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function money(value: number) { return Number(value || 0).toFixed(2) + ' ريال'; }
