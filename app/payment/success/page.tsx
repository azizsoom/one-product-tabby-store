import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const db = createClient(supabaseUrl, supabaseKey);

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const params = await searchParams;
  const orderId = params.order_id || '';

  if (orderId) {
    await db
      .from('orders')
      .update({
        payment_status: 'paid_test',
        order_status: 'confirmed',
      })
      .eq('id', orderId);

    redirect(`/order?order_id=${orderId}`);
  }

  redirect('/order');
}
