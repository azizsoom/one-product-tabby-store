'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/db';

type Order = {
  id: string;
  customer_name: string | null;
  customer_mobile: string | null;
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
  created_at: string;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    const { data, error } = await db
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setMessage('تعذر تحميل الطلبات: ' + error.message);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="text-sm text-emerald-700">الرجوع للوحة التحكم</Link>
        <div className="mt-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-black">الطلبات</h1>
            <p className="mt-2 text-stone-600">مراجعة الطلبات والحسابات قبل ربط تابي.</p>
          </div>
          <button onClick={loadOrders} className="rounded-2xl bg-stone-950 px-5 py-3 font-bold text-white">تحديث</button>
        </div>

        {message ? <p className="mt-4 rounded-2xl bg-white p-4 text-sm ring-1 ring-stone-200">{message}</p> : null}

        <div className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200">
          {loading ? (
            <div className="p-6">جاري التحميل...</div>
          ) : orders.length === 0 ? (
            <div className="p-6 text-stone-600">لا توجد طلبات حتى الآن.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-stone-100 text-stone-600">
                  <tr>
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">العميل</th>
                    <th className="p-3 text-right">الجوال</th>
                    <th className="p-3 text-right">المنتج</th>
                    <th className="p-3 text-right">قبل الخصم</th>
                    <th className="p-3 text-right">الخصم</th>
                    <th className="p-3 text-right">الخاضع للضريبة</th>
                    <th className="p-3 text-right">الضريبة</th>
                    <th className="p-3 text-right">الشحن</th>
                    <th className="p-3 text-right">الإجمالي</th>
                    <th className="p-3 text-right">الدفع</th>
                    <th className="p-3 text-right">الطلب</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-t border-stone-100">
                      <td className="p-3">{new Date(order.created_at).toLocaleString('ar-SA')}</td>
                      <td className="p-3">{order.customer_name || '-'}</td>
                      <td className="p-3">{order.customer_mobile || '-'}</td>
                      <td className="p-3 font-bold">{order.product_name}</td>
                      <td className="p-3">{money(order.subtotal_before_discount)}</td>
                      <td className="p-3">{money(order.discount_amount)}</td>
                      <td className="p-3">{money(order.taxable_amount)}</td>
                      <td className="p-3">{money(order.vat_amount)}</td>
                      <td className="p-3">{order.shipping_amount === 0 ? 'مجاني' : money(order.shipping_amount)}</td>
                      <td className="p-3 font-black">{money(order.total_amount)}</td>
                      <td className="p-3">{order.payment_status}</td>
                      <td className="p-3">{order.order_status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function money(value: number) {
  return Number(value || 0).toFixed(2) + ' ريال';
}
