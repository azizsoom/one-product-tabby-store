import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const db = createClient(supabaseUrl, supabaseKey);

type RequestedItem = { productId: string; quantity: number };

type StoreSettings = Record<string, string>;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const destinationCity = String(body.destinationCity || '').trim();
    const destinationCountry = String(body.destinationCountry || 'SA').trim() || 'SA';
    const requestedItems: RequestedItem[] = Array.isArray(body.items)
      ? body.items.map((item: any) => ({ productId: String(item.productId || ''), quantity: Math.max(1, Math.floor(Number(item.quantity || 1))) })).filter((item: RequestedItem) => item.productId)
      : [];

    if (!destinationCity) return NextResponse.json({ error: 'أدخل مدينة الشحن أولاً.' }, { status: 400 });
    if (requestedItems.length === 0) return NextResponse.json({ error: 'السلة فارغة.' }, { status: 400 });

    const settings = await getStoreSettings();
    const otoEnabled = settings.oto_enabled === 'true';
    const refreshToken = settings.oto_refresh_token || '';
    const originCity = settings.oto_origin_city || 'Riyadh';
    const originCountry = settings.oto_origin_country || 'SA';
    const fallbackDivisor = Number(settings.oto_volumetric_divisor || 5000);

    const productIds = requestedItems.map((item) => item.productId);
    const { data: products, error } = await db.from('products').select('*').in('id', productIds);
    if (error || !products || products.length === 0) return NextResponse.json({ error: 'تعذر قراءة المنتجات.' }, { status: 400 });

    const packageInfo = calculatePackage(requestedItems, products as any[], fallbackDivisor);

    if (!otoEnabled || !refreshToken) {
      return NextResponse.json({
        source: 'fallback',
        package: packageInfo,
        options: [{
          id: 'fallback-shipping',
          deliveryOptionId: null,
          company: 'الشحن الافتراضي',
          service: 'سعر احتياطي',
          price: packageInfo.fallbackShippingAmount,
          currency: 'SAR',
          eta: 'حسب شركة الشحن المتاحة',
          raw: null,
        }],
        warning: 'لم يتم تفعيل OTO أو إضافة Refresh Token. تم عرض سعر احتياطي.',
      });
    }

    const accessToken = await getOtoAccessToken(refreshToken);
    const ratePayload = {
      originCity,
      destinationCity,
      originCountry,
      destinationCountry,
      weight: packageInfo.chargeableWeight,
      currency: 'SAR',
      packageCount: 1,
      length: packageInfo.length,
      width: packageInfo.width,
      height: packageInfo.height,
      totalDue: 0,
    };

    const response = await fetch('https://api.tryoto.com/rest/v2/checkOTODeliveryFee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(ratePayload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: 'تعذر جلب أسعار OTO.', details: data }, { status: response.status });

    const options = normalizeOtoOptions(data);
    return NextResponse.json({ source: 'oto', package: packageInfo, options, raw: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'خطأ غير متوقع في حساب الشحن.' }, { status: 500 });
  }
}

async function getStoreSettings(): Promise<StoreSettings> {
  const { data } = await db.from('store_settings').select('key,value');
  const settings: StoreSettings = {};
  (data || []).forEach((row: any) => { settings[row.key] = row.value || ''; });
  return settings;
}

async function getOtoAccessToken(refreshToken: string) {
  const response = await fetch('https://api.tryoto.com/rest/v2/refreshToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('تعذر الحصول على Access Token من OTO.');
  const token = data?.access_token || data?.accessToken || data?.token || data?.data?.access_token || data?.data?.accessToken;
  if (!token) throw new Error('OTO لم يرجع Access Token واضح.');
  return token;
}

function calculatePackage(items: RequestedItem[], products: any[], divisor: number) {
  let actualWeight = 0;
  let fallbackShippingAmount = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let totalHeight = 0;

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;
    const quantity = Math.max(1, Number(item.quantity || 1));
    const weight = Number(product.weight_kg || product.product_weight_kg || 1);
    const length = Number(product.length_cm || product.box_length_cm || 20);
    const width = Number(product.width_cm || product.box_width_cm || 20);
    const height = Number(product.height_cm || product.box_height_cm || 20);

    actualWeight += weight * quantity;
    maxLength = Math.max(maxLength, length);
    maxWidth = Math.max(maxWidth, width);
    totalHeight += height * quantity;
    fallbackShippingAmount = Math.max(fallbackShippingAmount, Number(product.shipping_amount || 0));
  }

  const length = Math.max(1, maxLength || 20);
  const width = Math.max(1, maxWidth || 20);
  const height = Math.max(1, totalHeight || 20);
  const volumetricWeight = round((length * width * height) / Math.max(1, divisor));
  const chargeableWeight = Math.max(round(actualWeight || 1), volumetricWeight, 1);

  return {
    actualWeight: round(actualWeight || 1),
    volumetricWeight,
    chargeableWeight,
    length,
    width,
    height,
    divisor,
    fallbackShippingAmount,
  };
}

function normalizeOtoOptions(data: any) {
  const candidates = data?.deliveryOptions || data?.availableDeliveryOptions || data?.data || data?.options || data?.deliveryOptionsList || [];
  const list = Array.isArray(candidates) ? candidates : Array.isArray(candidates?.deliveryOptions) ? candidates.deliveryOptions : [];

  return list.map((item: any, index: number) => ({
    id: String(item.deliveryOptionId || item.id || item.optionId || index),
    deliveryOptionId: item.deliveryOptionId || item.id || item.optionId || null,
    company: item.deliveryCompanyName || item.companyName || item.name || item.deliveryCompany || 'شركة شحن',
    service: item.serviceType || item.serviceName || item.type || 'خدمة شحن',
    price: Number(item.price || item.deliveryFee || item.fee || item.amount || item.total || 0),
    currency: item.currency || 'SAR',
    eta: item.estimatedDeliveryTime || item.eta || item.deliveryTime || item.duration || '',
    raw: item,
  })).filter((item: any) => Number(item.price || 0) >= 0);
}

function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
