import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const fallbackTamaraToken = process.env.TAMARA_API_TOKEN || '';
const fallbackTamaraApiUrl = process.env.TAMARA_API_URL || 'https://api-sandbox.tamara.co';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://one-product-tabby-store.vercel.app';
const db = createClient(supabaseUrl, supabaseKey);

type RequestedItem = { productId: string; quantity: number };
type StoreSettings = Record<string, string>;
type DiscountCode = { id:string; code:string; type:'percentage'|'fixed'; value:number; max_discount_amount:number|null; is_active:boolean; usage_limit:number|null; used_count:number };
type ShippingInfo = { fulfillmentType?: 'shipping' | 'pickup'; city?: string; cityLabel?: string; district?: string; address?: string; notes?: string; shortAddress?: string; buildingNumber?: string; street?: string; postalCode?: string; additionalNumber?: string; selectedOption?: any };

export async function POST(request: NextRequest) {
  try {
    const settings = await getStoreSettings();
    const enabled = (settings.tamara_enabled || process.env.TAMARA_ENABLED || 'false') === 'true';
    const token = settings.tamara_api_token || fallbackTamaraToken;
    const baseUrl = (settings.tamara_api_url || fallbackTamaraApiUrl).replace(/\/$/, '');
    if (!enabled) return NextResponse.json({ error: 'تمارا غير مفعلة من إعدادات المتجر.' }, { status: 400 });
    if (!token) return NextResponse.json({ error: 'مفتاح Tamara API غير موجود في الإعدادات أو Vercel.' }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const customerName = String(body.customerName || 'عميل المتجر').trim();
    const customerMobile = String(body.customerMobile || '0550000000').trim();
    const customerEmail = String(body.customerEmail || 'customer@example.com').trim();
    const discountCode = String(body.discountCode || '').trim().toUpperCase();
    const shippingInfo: ShippingInfo = body.shippingInfo || {};
    const fulfillmentType = shippingInfo.fulfillmentType === 'pickup' ? 'pickup' : 'shipping';
    const selectedOption = shippingInfo.selectedOption || null;
    const selectedShippingAmount = selectedOption && fulfillmentType === 'shipping' ? Math.max(0, Number(selectedOption.price || 0)) : null;

    const requestedItems: RequestedItem[] = Array.isArray(body.items)
      ? body.items.map((item: any) => ({ productId: String(item.productId || ''), quantity: Math.max(1, Math.floor(Number(item.quantity || 1))) })).filter((item: RequestedItem) => item.productId)
      : [];
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
      payment_method: 'tamara',
      payment_status: 'pending',
      order_status: 'new',
      shipping_company: selectedOption?.company || null,
      admin_notes: JSON.stringify({
        provider: 'tamara',
        cart_items: cartItems.map((item) => ({ product_id: item.product.id, name: item.product.name, quantity: item.quantity, unit_price_before_vat: Number(item.product.price_before_vat || 0) })),
        shipping_info: { fulfillment_type: fulfillmentType, city: shippingInfo.city || '', city_label: shippingInfo.cityLabel || '', district: shippingInfo.district || '', address: shippingInfo.address || '', short_address: shippingInfo.shortAddress || '', building_number: shippingInfo.buildingNumber || '', street: shippingInfo.street || '', postal_code: shippingInfo.postalCode || '', additional_number: shippingInfo.additionalNumber || '', notes: shippingInfo.notes || '', selected_option: selectedOption },
        discount: discount ? { code: discount.code, type: discount.type, value: discount.value } : null,
      }),
    }).select('*').single();
    if (orderError || !order) return NextResponse.json({ error: orderError?.message || 'Order creation failed.' }, { status: 500 });

    if (discount) await db.from('discount_codes').update({ used_count: Number(discount.used_count || 0) + 1 }).eq('id', discount.id);

    const customer = splitName(customerName);
    const checkoutPayload = {
      total_amount: money(totals.totalAmount),
      shipping_amount: money(totals.shippingAmount),
      tax_amount: money(totals.vatAmount),
      order_reference_id: String(order.id),
      order_number: String(order.id),
      discount: { name: discount?.code || 'discount', amount: money(totals.discountAmount) },
      items: cartItems.map((item) => {
        const unit = roundMoney(Number(item.product.price_before_vat || 0));
        const itemTotal = roundMoney(unit * item.quantity);
        return {
          name: String(item.product.name || 'Product').slice(0, 255),
          type: 'Physical',
          reference_id: String(item.product.id),
          sku: String(item.product.id).slice(0, 128),
          quantity: item.quantity,
          unit_price: money(unit),
          tax_amount: money(roundMoney(itemTotal * 0.15)),
          discount_amount: money(0),
          total_amount: money(itemTotal),
          image_url: item.product.image_url || undefined,
          item_url: `${siteUrl}/`,
        };
      }),
      consumer: { first_name: customer.firstName, last_name: customer.lastName, phone_number: normalizeSaudiPhone(customerMobile), email: customerEmail },
      country_code: 'SA',
      description: mainProductName.slice(0, 256),
      merchant_url: { success: `${siteUrl}/payment/success?order_id=${order.id}&provider=tamara`, cancel: `${siteUrl}/payment/cancel?order_id=${order.id}&provider=tamara`, failure: `${siteUrl}/payment/failure?order_id=${order.id}&provider=tamara`, notification: `${siteUrl}/api/webhooks/tamara` },
      shipping_address: buildAddress(customer, customerMobile, shippingInfo),
      billing_address: buildAddress(customer, customerMobile, shippingInfo),
      platform: 'one-product-tabby-store',
      is_mobile: false,
      locale: 'ar_SA',
      additional_data: { fulfillment_type: fulfillmentType, shipping_company: selectedOption?.company || '', short_address: shippingInfo.shortAddress || '' },
    };

    const tamaraResponse = await fetch(`${baseUrl}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(checkoutPayload) });
    const tamaraData = await tamaraResponse.json().catch(() => ({}));
    if (!tamaraResponse.ok) return NextResponse.json({ error: 'Tamara checkout failed.', details: tamaraData }, { status: tamaraResponse.status });

    const tamaraOrderId = tamaraData?.order_id || null;
    const tamaraCheckoutId = tamaraData?.checkout_id || null;
    const webUrl = tamaraData?.checkout_url || tamaraData?.web_url || tamaraData?.redirect_url;
    await db.from('orders').update({ admin_notes: JSON.stringify({ provider: 'tamara', tamara_order_id: tamaraOrderId, tamara_checkout_id: tamaraCheckoutId, tamara_status: tamaraData?.status || '', original_admin_notes: order.admin_notes }) }).eq('id', order.id);

    if (!webUrl) return NextResponse.json({ error: 'Tamara did not return checkout_url.', details: tamaraData }, { status: 500 });
    return NextResponse.json({ webUrl, orderId: order.id, tamaraOrderId, tamaraCheckoutId });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unexpected error.' }, { status: 500 });
  }
}

async function getStoreSettings(): Promise<StoreSettings> { const { data } = await db.from('store_settings').select('key,value'); const settings: StoreSettings = {}; (data || []).forEach((row: any) => { settings[row.key] = row.value || ''; }); return settings; }
async function getValidDiscount(code: string, subtotal: number): Promise<DiscountCode | null> { const { data } = await db.from('discount_codes').select('*').eq('code', code).single(); const discount = data as DiscountCode | null; if (!discount || !discount.is_active) return null; if (discount.usage_limit !== null && Number(discount.used_count || 0) >= Number(discount.usage_limit)) return null; if (Number(discount.value || 0) <= 0 || subtotal <= 0) return null; return discount; }
function calculateCartOrder(cartItems: Array<{ product: any; quantity: number }>, discount: DiscountCode | null, fulfillmentType: 'shipping' | 'pickup', selectedShippingAmount: number | null) { const subtotalBeforeDiscount = roundMoney(cartItems.reduce((sum, item) => sum + Number(item.product.price_before_vat || 0) * item.quantity, 0)); const rawDiscount = discount ? (discount.type === 'percentage' ? subtotalBeforeDiscount * (Number(discount.value || 0) / 100) : Number(discount.value || 0)) : 0; const cappedDiscount = discount?.max_discount_amount ? Math.min(rawDiscount, Number(discount.max_discount_amount)) : rawDiscount; const discountAmount = roundMoney(Math.min(subtotalBeforeDiscount, Math.max(0, cappedDiscount))); const taxableAmount = roundMoney(subtotalBeforeDiscount - discountAmount); const vatAmount = roundMoney(taxableAmount * 0.15); const fallbackShipping = roundMoney(cartItems.length === 0 ? 0 : Math.max(...cartItems.map((item) => Number(item.product.shipping_amount || 0)))); const shippingAmount = fulfillmentType === 'pickup' ? 0 : roundMoney(selectedShippingAmount !== null ? selectedShippingAmount : fallbackShipping); const totalAmount = roundMoney(taxableAmount + vatAmount + shippingAmount); return { subtotalBeforeDiscount, discountAmount, taxableAmount, vatAmount, shippingAmount, totalAmount }; }
function money(amount: number) { return { amount: roundMoney(amount).toFixed(2), currency: 'SAR' }; }
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function normalizeSaudiPhone(phone: string) { const digits = String(phone || '').replace(/\D/g, ''); if (digits.startsWith('966')) return '+' + digits; if (digits.startsWith('05')) return '+966' + digits.slice(1); if (digits.startsWith('5')) return '+966' + digits; return '+966550000000'; }
function splitName(name: string) { const parts = String(name || 'عميل المتجر').trim().split(/\s+/); return { firstName: parts[0] || 'عميل', lastName: parts.slice(1).join(' ') || 'المتجر' }; }
function buildAddress(customer: { firstName: string; lastName: string }, mobile: string, shippingInfo: ShippingInfo) { return { first_name: customer.firstName, last_name: customer.lastName, line1: shippingInfo.address || shippingInfo.street || 'Riyadh', line2: shippingInfo.notes || shippingInfo.shortAddress || '', region: shippingInfo.district || shippingInfo.cityLabel || 'Riyadh', city: shippingInfo.cityLabel || shippingInfo.city || 'Riyadh', postal_code: shippingInfo.postalCode || '00000', country_code: 'SA', phone_number: normalizeSaudiPhone(mobile) }; }
