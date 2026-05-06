import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const fallbackTabbySecretKey = process.env.TABBY_SECRET_KEY || '';
const fallbackMerchantCode = process.env.TABBY_MERCHANT_CODE || '';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://one-product-tabby-store.vercel.app';
const db = createClient(supabaseUrl, supabaseKey);

type RequestedItem = { productId: string; quantity: number };
type StoreSettings = Record<string, string>;
type DiscountCode = { id:string; code:string; type:'percentage'|'fixed'; value:number; max_discount_amount:number|null; is_active:boolean; usage_limit:number|null; used_count:number };
type ShippingInfo = { fulfillmentType?: 'shipping' | 'pickup'; city?: string; district?: string; address?: string; notes?: string; selectedOption?: any };

export async function POST(request: NextRequest) {
  try {
    const settings = await getStoreSettings();
    const tabbySecretKey = settings.tabby_secret_key || fallbackTabbySecretKey;
    const merchantCode = settings.tabby_merchant_code || fallbackMerchantCode;
    const tabbyApiUrl = settings.tabby_api_url || 'https://api.tabby.sa/api/v2/checkout';
    if (!tabbySecretKey || !merchantCode) return NextResponse.json({ error: 'Tabby keys are missing in admin settings or Vercel.' }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const customerName = body.customerName || 'عميل المتجر';
    const customerMobile = body.customerMobile || '0550000000';
    const customerEmail = body.customerEmail || 'customer@example.com';
    const discountCode = String(body.discountCode || '').trim().toUpperCase();
    const shippingInfo: ShippingInfo = body.shippingInfo || {};
    const fulfillmentType = shippingInfo.fulfillmentType === 'pickup' ? 'pickup' : 'shipping';
    const selectedOption = shippingInfo.selectedOption || null;
    const selectedShippingAmount = selectedOption && fulfillmentType === 'shipping' ? Math.max(0, Number(selectedOption.price || 0)) : null;

    const requestedItems: RequestedItem[] = Array.isArray(body.items)
      ? body.items.map((item: any) => ({ productId: String(item.productId || ''), quantity: Math.max(1, Math.floor(Number(item.quantity || 1))) })).filter((item: RequestedItem) => item.productId)
      : body.productId ? [{ productId: String(body.productId), quantity: Math.max(1, Math.floor(Number(body.quantity || 1))) }] : [];
    if (requestedItems.length === 0) return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 });

    const productIds = requestedItems.map((item) => item.productId);
    const { data: products, error: productError } = await db.from('products').select('*').eq('is_active', true).in('id', productIds);
    if (productError || !products || products.length === 0) return NextResponse.json({ error: 'No active products found.' }, { status: 400 });
    if (products.length !== productIds.length) return NextResponse.json({ error: 'One or more products are not available.' }, { status: 400 });

    const cartItems = requestedItems.map((requested) => {
      const product = products.find((item: any) => item.id === requested.productId);
      if (!product) throw new Error('Product not found in cart.');
      const stockQuantity = Number(product.stock_quantity ?? 0);
      if (stockQuantity <= 0) throw new Error(`Product is out of stock: ${product.name}`);
      if (requested.quantity > stockQuantity) throw new Error(`Requested quantity is more than stock for ${product.name}. Available: ${stockQuantity}`);
      return { product, quantity: requested.quantity };
    });

    const subtotalBeforeDiscount = roundMoney(cartItems.reduce((sum, item) => sum + Number(item.product.price_before_vat || 0) * item.quantity, 0));
    const discount = discountCode ? await getValidDiscount(discountCode, subtotalBeforeDiscount) : null;
    if (discountCode && !discount) return NextResponse.json({ error: 'كود الخصم غير صحيح أو غير فعال أو تجاوز حد الاستخدام.' }, { status: 400 });

    const totals = calculateCartOrder(cartItems, discount, fulfillmentType, selectedShippingAmount);
    const mainProductName = cartItems.length === 1 ? cartItems[0].product.name : `طلب من المتجر - ${cartItems.length} منتجات`;
    const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    const { data: order, error: orderError } = await db.from('orders').insert({
      customer_name: customerName,
      customer_mobile: customerMobile,
      customer_email: customerEmail,
      product_id: cartItems[0].product.id,
      product_name: mainProductName,
      quantity: totalQuantity,
      unit_price_before_vat: Number(cartItems[0].product.price_before_vat || 0),
      subtotal_before_discount: totals.subtotalBeforeDiscount,
      discount_code: discount?.code || null,
      discount_amount: totals.discountAmount,
      taxable_amount: totals.taxableAmount,
      vat_rate: 0.15,
      vat_amount: totals.vatAmount,
      shipping_amount: totals.shippingAmount,
      total_amount: totals.totalAmount,
      payment_method: 'tabby',
      payment_status: 'pending',
      order_status: 'new',
      shipping_company: selectedOption?.company || null,
      admin_notes: JSON.stringify({
        cart_items: cartItems.map((item) => ({ product_id: item.product.id, name: item.product.name, quantity: item.quantity, unit_price_before_vat: Number(item.product.price_before_vat || 0) })),
        shipping_info: { fulfillment_type: fulfillmentType, city: shippingInfo.city || '', district: shippingInfo.district || '', address: shippingInfo.address || '', notes: shippingInfo.notes || '', selected_option: selectedOption },
        discount: discount ? { code: discount.code, type: discount.type, value: discount.value } : null,
      }),
    }).select('*').single();
    if (orderError || !order) return NextResponse.json({ error: orderError?.message || 'Order creation failed.' }, { status: 500 });

    if (discount) await db.from('discount_codes').update({ used_count: Number(discount.used_count || 0) + 1 }).eq('id', discount.id);

    const checkoutPayload = {
      payment: {
        amount: totals.totalAmount.toFixed(2), currency: 'SAR', description: mainProductName,
        buyer: { name: customerName, email: customerEmail, phone: normalizeSaudiPhone(customerMobile) },
        order: {
          reference_id: order.id,
          items: cartItems.map((item) => ({ title: item.product.name, description: item.product.description || item.product.name, quantity: item.quantity, unit_price: Number(item.product.price_before_vat || 0).toFixed(2), category: 'product' })),
          tax_amount: totals.vatAmount.toFixed(2), shipping_amount: totals.shippingAmount.toFixed(2), discount_amount: totals.discountAmount.toFixed(2),
        },
        buyer_history: { registered_since: new Date().toISOString(), loyalty_level: 0, wishlist_count: 0, is_social_networks_connected: false, is_phone_number_verified: true, is_email_verified: false },
        order_history: [],
        shipping_address: { city: shippingInfo.city || 'Riyadh', address: [shippingInfo.district, shippingInfo.address].filter(Boolean).join(' - ') || 'Riyadh', zip: '00000' },
        meta: { order_id: order.id, items_count: cartItems.length, total_quantity: totalQuantity, fulfillment_type: fulfillmentType, shipping_company: selectedOption?.company || '' },
      },
      lang: 'ar', merchant_code: merchantCode,
      merchant_urls: { success: `${siteUrl}/payment/success?order_id=${order.id}`, cancel: `${siteUrl}/payment/cancel?order_id=${order.id}`, failure: `${siteUrl}/payment/failure?order_id=${order.id}` },
    };

    const tabbyResponse = await fetch(tabbyApiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tabbySecretKey}` }, body: JSON.stringify(checkoutPayload) });
    const tabbyData = await tabbyResponse.json().catch(() => ({}));
    if (!tabbyResponse.ok) return NextResponse.json({ error: 'Tabby checkout failed.', details: tabbyData }, { status: tabbyResponse.status });
    const paymentId = tabbyData?.payment?.id || tabbyData?.id || null;
    const webUrl = tabbyData?.configuration?.available_products?.installments?.[0]?.web_url || tabbyData?.web_url;
    if (paymentId) await db.from('orders').update({ tabby_payment_id: paymentId }).eq('id', order.id);
    if (!webUrl) return NextResponse.json({ error: 'Tabby did not return web_url.', details: tabbyData }, { status: 500 });
    return NextResponse.json({ webUrl, orderId: order.id, tabbyPaymentId: paymentId });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error.' }, { status: 500 });
  }
}

async function getStoreSettings(): Promise<StoreSettings> { const { data } = await db.from('store_settings').select('key,value'); const settings: StoreSettings = {}; (data || []).forEach((row: any) => { settings[row.key] = row.value || ''; }); return settings; }
async function getValidDiscount(code: string, subtotal: number): Promise<DiscountCode | null> { const { data } = await db.from('discount_codes').select('*').eq('code', code).single(); const discount = data as DiscountCode | null; if (!discount || !discount.is_active) return null; if (discount.usage_limit !== null && Number(discount.used_count || 0) >= Number(discount.usage_limit)) return null; if (Number(discount.value || 0) <= 0 || subtotal <= 0) return null; return discount; }
function calculateCartOrder(cartItems: Array<{ product: any; quantity: number }>, discount: DiscountCode | null, fulfillmentType: 'shipping' | 'pickup', selectedShippingAmount: number | null) { const subtotalBeforeDiscount = roundMoney(cartItems.reduce((sum, item) => sum + Number(item.product.price_before_vat || 0) * item.quantity, 0)); const rawDiscount = discount ? (discount.type === 'percentage' ? subtotalBeforeDiscount * (Number(discount.value || 0) / 100) : Number(discount.value || 0)) : 0; const cappedDiscount = discount?.max_discount_amount ? Math.min(rawDiscount, Number(discount.max_discount_amount)) : rawDiscount; const discountAmount = roundMoney(Math.min(subtotalBeforeDiscount, Math.max(0, cappedDiscount))); const taxableAmount = roundMoney(subtotalBeforeDiscount - discountAmount); const vatAmount = roundMoney(taxableAmount * 0.15); const fallbackShipping = roundMoney(cartItems.length === 0 ? 0 : Math.max(...cartItems.map((item) => Number(item.product.shipping_amount || 0)))); const shippingAmount = fulfillmentType === 'pickup' ? 0 : roundMoney(selectedShippingAmount !== null ? selectedShippingAmount : fallbackShipping); const totalAmount = roundMoney(taxableAmount + vatAmount + shippingAmount); return { subtotalBeforeDiscount, discountAmount, taxableAmount, vatAmount, shippingAmount, totalAmount }; }
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function normalizeSaudiPhone(phone: string) { const digits = String(phone || '').replace(/\D/g, ''); if (digits.startsWith('966')) return '+' + digits; if (digits.startsWith('05')) return '+966' + digits.slice(1); if (digits.startsWith('5')) return '+966' + digits; return '+966550000000'; }
