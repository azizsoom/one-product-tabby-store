import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const tabbySecretKey = process.env.TABBY_SECRET_KEY || '';
const merchantCode = process.env.TABBY_MERCHANT_CODE || '';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://one-product-tabby-store.vercel.app';

const db = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    if (!tabbySecretKey || !merchantCode) {
      return NextResponse.json({ error: 'Tabby keys are missing in Vercel.' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const productId = body.productId || '';
    const customerName = body.customerName || 'عميل المتجر';
    const customerMobile = body.customerMobile || '0550000000';
    const customerEmail = body.customerEmail || 'customer@example.com';
    const requestedQuantity = Math.max(1, Math.floor(Number(body.quantity || 1)));

    let productQuery = db.from('products').select('*').eq('is_active', true).limit(1);
    if (productId) productQuery = productQuery.eq('id', productId);
    const { data: product, error: productError } = await productQuery.single();

    if (productError || !product) {
      return NextResponse.json({ error: 'No active product found.' }, { status: 400 });
    }

    const stockQuantity = Number(product.stock_quantity ?? 0);
    if (stockQuantity <= 0) {
      return NextResponse.json({ error: 'Product is out of stock.' }, { status: 400 });
    }

    if (requestedQuantity > stockQuantity) {
      return NextResponse.json({ error: `Requested quantity is more than stock. Available: ${stockQuantity}` }, { status: 400 });
    }

    const totals = calculateOrder({
      unitPriceBeforeVat: Number(product.price_before_vat || 0),
      quantity: requestedQuantity,
      discountType: 'percentage',
      discountValue: 10,
      shippingAmount: Number(product.shipping_amount || 0),
    });

    const { data: order, error: orderError } = await db
      .from('orders')
      .insert({
        customer_name: customerName,
        customer_mobile: customerMobile,
        customer_email: customerEmail,
        product_id: product.id,
        product_name: product.name,
        quantity: requestedQuantity,
        unit_price_before_vat: Number(product.price_before_vat || 0),
        subtotal_before_discount: totals.subtotalBeforeDiscount,
        discount_code: 'TEST10',
        discount_amount: totals.discountAmount,
        taxable_amount: totals.taxableAmount,
        vat_rate: 0.15,
        vat_amount: totals.vatAmount,
        shipping_amount: totals.shippingAmount,
        total_amount: totals.totalAmount,
        payment_method: 'tabby',
        payment_status: 'pending',
        order_status: 'new',
      })
      .select('*')
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message || 'Order creation failed.' }, { status: 500 });
    }

    const amount = totals.totalAmount.toFixed(2);
    const checkoutPayload = {
      payment: {
        amount,
        currency: 'SAR',
        description: product.name,
        buyer: {
          name: customerName,
          email: customerEmail,
          phone: normalizeSaudiPhone(customerMobile),
        },
        order: {
          reference_id: order.id,
          items: [
            {
              title: product.name,
              description: product.description || product.name,
              quantity: requestedQuantity,
              unit_price: Number(product.price_before_vat || 0).toFixed(2),
              category: 'product',
            },
          ],
          tax_amount: totals.vatAmount.toFixed(2),
          shipping_amount: totals.shippingAmount.toFixed(2),
          discount_amount: totals.discountAmount.toFixed(2),
        },
        buyer_history: {
          registered_since: new Date().toISOString(),
          loyalty_level: 0,
          wishlist_count: 0,
          is_social_networks_connected: false,
          is_phone_number_verified: true,
          is_email_verified: false,
        },
        order_history: [],
        shipping_address: {
          city: 'Riyadh',
          address: 'Riyadh',
          zip: '00000',
        },
        meta: {
          order_id: order.id,
          product_id: product.id,
          quantity: requestedQuantity,
        },
      },
      lang: 'ar',
      merchant_code: merchantCode,
      merchant_urls: {
        success: `${siteUrl}/payment/success?order_id=${order.id}`,
        cancel: `${siteUrl}/payment/cancel?order_id=${order.id}`,
        failure: `${siteUrl}/payment/failure?order_id=${order.id}`,
      },
    };

    const tabbyResponse = await fetch('https://api.tabby.sa/api/v2/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tabbySecretKey}`,
      },
      body: JSON.stringify(checkoutPayload),
    });

    const tabbyData = await tabbyResponse.json().catch(() => ({}));

    if (!tabbyResponse.ok) {
      return NextResponse.json({ error: 'Tabby checkout failed.', details: tabbyData }, { status: tabbyResponse.status });
    }

    const paymentId = tabbyData?.payment?.id || tabbyData?.id || null;
    const webUrl = tabbyData?.configuration?.available_products?.installments?.[0]?.web_url || tabbyData?.web_url;

    if (paymentId) {
      await db.from('orders').update({ tabby_payment_id: paymentId }).eq('id', order.id);
    }

    if (!webUrl) {
      return NextResponse.json({ error: 'Tabby did not return web_url.', details: tabbyData }, { status: 500 });
    }

    return NextResponse.json({ webUrl, orderId: order.id, tabbyPaymentId: paymentId });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error.' }, { status: 500 });
  }
}

function calculateOrder(input: {
  unitPriceBeforeVat: number;
  quantity: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  shippingAmount?: number;
}) {
  const vatRate = 0.15;
  const subtotalBeforeDiscount = roundMoney(input.unitPriceBeforeVat * input.quantity);
  const rawDiscount = input.discountType === 'percentage'
    ? subtotalBeforeDiscount * ((input.discountValue || 0) / 100)
    : (input.discountValue || 0);
  const discountAmount = roundMoney(Math.min(subtotalBeforeDiscount, Math.max(0, rawDiscount)));
  const taxableAmount = roundMoney(subtotalBeforeDiscount - discountAmount);
  const vatAmount = roundMoney(taxableAmount * vatRate);
  const shippingAmount = roundMoney(Math.max(0, input.shippingAmount || 0));
  const totalAmount = roundMoney(taxableAmount + vatAmount + shippingAmount);
  return { subtotalBeforeDiscount, discountAmount, taxableAmount, vatAmount, shippingAmount, totalAmount };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeSaudiPhone(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('966')) return '+' + digits;
  if (digits.startsWith('05')) return '+966' + digits.slice(1);
  if (digits.startsWith('5')) return '+966' + digits;
  return '+966550000000';
}
