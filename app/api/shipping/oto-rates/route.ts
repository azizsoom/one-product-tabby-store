import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const db = createClient(supabaseUrl, supabaseKey);

type RequestedItem = { productId: string; quantity: number };
type StoreSettings = Record<string, string>;
type NormalizedCity = { input: string; city: string; matched: boolean };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const destinationCityInput = String(body.destinationCity || '').trim();
    const destinationCountry = String(body.destinationCountry || 'SA').trim() || 'SA';
    const destinationCityInfo = normalizeOtoCity(destinationCityInput);
    const destinationCity = destinationCityInfo.city;
    const requestedItems: RequestedItem[] = Array.isArray(body.items)
      ? body.items
          .map((item: any) => ({ productId: String(item.productId || ''), quantity: Math.max(1, Math.floor(Number(item.quantity || 1))) }))
          .filter((item: RequestedItem) => item.productId)
      : [];

    if (!destinationCityInput) return NextResponse.json({ error: 'أدخل مدينة الشحن أولاً.' }, { status: 400 });
    if (requestedItems.length === 0) return NextResponse.json({ error: 'السلة فارغة.' }, { status: 400 });

    const settings = await getStoreSettings();
    const otoEnabled = settings.oto_enabled === 'true';
    const refreshToken = settings.oto_refresh_token || '';
    const originCityInfo = normalizeOtoCity(settings.oto_origin_city || 'Riyadh');
    const originCity = originCityInfo.city || 'Riyadh';
    const originCountry = settings.oto_origin_country || 'SA';
    const fallbackDivisor = Number(settings.oto_volumetric_divisor || 5000);

    const productIds = requestedItems.map((item) => item.productId);
    const { data: products, error } = await db.from('products').select('*').in('id', productIds);
    if (error || !products || products.length === 0) return NextResponse.json({ error: 'تعذر قراءة المنتجات.' }, { status: 400 });

    const packageInfo = calculatePackage(requestedItems, products as any[], fallbackDivisor);
    const cityInfo = buildCityInfo(originCityInfo, destinationCityInfo);

    if (!otoEnabled || !refreshToken) {
      return NextResponse.json({
        source: 'fallback',
        cities: cityInfo,
        package: packageInfo,
        options: [fallbackOption(packageInfo.fallbackShippingAmount)],
        warning: 'لم يتم تفعيل OTO أو إضافة Refresh Token. تم عرض سعر احتياطي.',
      });
    }

    const tokenData = await getOtoAccessToken(refreshToken);
    if (!tokenData.token) {
      return NextResponse.json({
        error: 'فشل الاتصال بـ OTO: Refresh Token غير صحيح أو غير مفعل.',
        cities: cityInfo,
        details: tokenData.details,
        options: [fallbackOption(packageInfo.fallbackShippingAmount)],
      }, { status: 400 });
    }

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
      boxes: [{
        width: packageInfo.width,
        length: packageInfo.length,
        height: packageInfo.height,
        weight: packageInfo.chargeableWeight,
        boxName: 'Cart Box',
      }],
      totalDue: 0,
    };

    const response = await fetch('https://api.tryoto.com/rest/v2/checkOTODeliveryFee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenData.token}` },
      body: JSON.stringify(ratePayload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({
        error: extractOtoMessage(data) || 'تعذر جلب أسعار OTO.',
        cities: cityInfo,
        details: data,
        options: [fallbackOption(packageInfo.fallbackShippingAmount)],
      }, { status: response.status });
    }

    const options = normalizeOtoOptions(data);
    if (options.length === 0) {
      return NextResponse.json({
        source: 'oto-empty',
        cities: cityInfo,
        package: packageInfo,
        options: [fallbackOption(packageInfo.fallbackShippingAmount)],
        warning: 'OTO اتصل بنجاح لكن لم يرجع شركات شحن. تم عرض سعر احتياطي. تأكد أن حساب OTO يدعم OTO Rates أو جرّب مدينة ووزن مختلفين.',
        debug: { responseKeys: Object.keys(data || {}), success: data?.success ?? null, message: extractOtoMessage(data) },
        raw: data,
      });
    }

    return NextResponse.json({ source: 'oto', cities: cityInfo, package: packageInfo, options, raw: data });
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

async function getOtoAccessToken(refreshToken: string): Promise<{ token: string; details: any }> {
  const response = await fetch('https://api.tryoto.com/rest/v2/refreshToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await response.json().catch(() => ({}));
  const token = data?.access_token || data?.accessToken || data?.token || data?.data?.access_token || data?.data?.accessToken || '';
  if (!response.ok || !token) return { token: '', details: data };
  return { token, details: data };
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
    const weight = Number(product.weight_kg || 1);
    const length = Number(product.length_cm || 20);
    const width = Number(product.width_cm || 20);
    const height = Number(product.height_cm || 20);
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
  return { actualWeight: round(actualWeight || 1), volumetricWeight, chargeableWeight, length, width, height, divisor, fallbackShippingAmount };
}

function normalizeOtoOptions(data: any) {
  const candidates =
    data?.deliveryCompany ||
    data?.deliveryCompanies ||
    data?.deliveryOptions ||
    data?.availableDeliveryOptions ||
    data?.options ||
    data?.deliveryOptionsList ||
    data?.deliveryOptionsPrices ||
    data?.data?.deliveryCompany ||
    data?.data?.deliveryCompanies ||
    data?.data?.deliveryOptions ||
    data?.data?.options ||
    data?.data ||
    [];

  const list = Array.isArray(candidates)
    ? candidates
    : Array.isArray(candidates?.deliveryCompany)
      ? candidates.deliveryCompany
      : Array.isArray(candidates?.deliveryOptions)
        ? candidates.deliveryOptions
        : [];

  return list.map((item: any, index: number) => {
    const price = Number(item.price ?? item.deliveryFee ?? item.fee ?? item.amount ?? item.total ?? item.totalPrice ?? 0);
    return {
      id: String(item.deliveryOptionId ?? item.id ?? item.optionId ?? `${item.deliveryCompanyName || item.deliveryOptionName || 'oto'}-${index}`),
      deliveryOptionId: item.deliveryOptionId ?? item.id ?? item.optionId ?? null,
      company: cleanCompanyName(item.deliveryCompanyName || item.deliveryOptionName || item.companyName || item.name || item.deliveryCompany || 'شركة شحن'),
      service: item.serviceType || item.serviceName || item.type || item.deliveryOptionName || 'خدمة شحن',
      price,
      currency: item.currency || data?.currency || 'SAR',
      eta: item.avgDeliveryTime || item.estimatedDeliveryTime || item.eta || item.deliveryTime || item.duration || '',
      logo: item.logo || '',
      raw: item,
    };
  }).filter((item: any) => item.deliveryOptionId !== null && Number.isFinite(item.price) && item.price >= 0);
}

function cleanCompanyName(value: string) {
  const map: Record<string, string> = {
    jtexpress: 'J&T Express',
    jandt: 'J&T Express',
    saudiPost: 'SPL',
    sms: 'SMSA',
    smsa: 'SMSA',
    aramex: 'Aramex',
    ups: 'UPS',
    dhl: 'DHL',
    imile: 'iMile',
    aymakan: 'Aymakan',
    kwickbox: 'Kwick Box',
  };
  const key = String(value || '').trim();
  return map[key] || key;
}

function fallbackOption(price: number) {
  return { id: 'fallback-shipping', deliveryOptionId: null, company: 'الشحن الافتراضي', service: 'سعر احتياطي', price: Number(price || 0), currency: 'SAR', eta: 'حسب المتوفر', raw: null };
}

function normalizeOtoCity(city: string): NormalizedCity {
  const input = String(city || '').trim();
  if (!input) return { input, city: '', matched: false };

  const key = normalizeCityKey(input);
  const cityMap: Record<string, string> = {
    'riyadh': 'Riyadh', 'alriyadh': 'Riyadh', 'arriyadh': 'Riyadh', 'الرياض': 'Riyadh', 'رياض': 'Riyadh',
    'jeddah': 'Jeddah', 'jedda': 'Jeddah', 'jiddah': 'Jeddah', 'jiddahcity': 'Jeddah', 'جدة': 'Jeddah', 'جده': 'Jeddah',
    'makkah': 'Makkah', 'mecca': 'Makkah', 'مكة': 'Makkah', 'مكه': 'Makkah', 'مكةالمكرمة': 'Makkah', 'مكهالمكرمه': 'Makkah',
    'madinah': 'Madinah', 'medina': 'Madinah', 'almadinah': 'Madinah', 'المدينة': 'Madinah', 'المدينه': 'Madinah', 'المدينةالمنورة': 'Madinah', 'المدينهالمنوره': 'Madinah',
    'dammam': 'Dammam', 'aldammam': 'Dammam', 'الدمام': 'Dammam',
    'khobar': 'Khobar', 'alkhobar': 'Khobar', 'al khobar': 'Khobar', 'الخبر': 'Khobar',
    'dhahran': 'Dhahran', 'aldhahran': 'Dhahran', 'الظهران': 'Dhahran',
    'qatif': 'Qatif', 'alqatif': 'Qatif', 'القطيف': 'Qatif',
    'jubail': 'Jubail', 'aljubail': 'Jubail', 'الجبيل': 'Jubail',
    'alahsa': 'Al Ahsa', 'al ahsa': 'Al Ahsa', 'ahsa': 'Al Ahsa', 'hassa': 'Al Ahsa', 'الأحساء': 'Al Ahsa', 'الاحساء': 'Al Ahsa', 'الاحسا': 'Al Ahsa',
    'hofuf': 'Hofuf', 'alhofuf': 'Hofuf', 'الهفوف': 'Hofuf',
    'taif': 'Taif', 'altaif': 'Taif', 'الطائف': 'Taif',
    'buraidah': 'Buraidah', 'buraydah': 'Buraidah', 'buraydahcity': 'Buraidah', 'بريدة': 'Buraidah', 'بريده': 'Buraidah', 'القصيم': 'Buraidah', 'القصيمبريدة': 'Buraidah',
    'unaizah': 'Unaizah', 'unayzah': 'Unaizah', 'onaizah': 'Unaizah', 'عنيزة': 'Unaizah', 'عنيزه': 'Unaizah',
    'arrass': 'ar rass', 'ar rass': 'ar rass', 'alrass': 'ar rass', 'al rass': 'ar rass', 'rass': 'ar rass', 'الرس': 'ar rass',
    'hail': 'Hail', 'ha il': 'Hail', ' حائل': 'Hail', 'حائل': 'Hail', 'حايل': 'Hail',
    'tabuk': 'Tabuk', 'تبوك': 'Tabuk',
    'abha': 'Abha', 'ابها': 'Abha', 'أبها': 'Abha',
    'khamismushait': 'Khamis Mushait', 'khamis mushait': 'Khamis Mushait', 'خميسمشيط': 'Khamis Mushait', 'خميس مشيط': 'Khamis Mushait',
    'jazan': 'Jazan', 'gizan': 'Jazan', 'جيزان': 'Jazan', 'جازان': 'Jazan',
    'najran': 'Najran', 'نجران': 'Najran',
    'yanbu': 'Yanbu', 'ينبع': 'Yanbu',
    'alkharj': 'Al Kharj', 'al kharj': 'Al Kharj', 'kharj': 'Al Kharj', 'الخرج': 'Al Kharj',
    'dawadmi': 'Dawadmi', 'aldawadmi': 'Dawadmi', 'الدوادمي': 'Dawadmi',
    'majmaah': 'Al Majmaah', 'almajmaah': 'Al Majmaah', 'al majmaah': 'Al Majmaah', 'المجمعة': 'Al Majmaah', 'المجمعه': 'Al Majmaah',
    'zulfi': 'Zulfi', 'az zulfi': 'Zulfi', 'الزلفي': 'Zulfi',
    'wadiaddawasir': 'Wadi ad-Dawasir', 'wadi ad dawasir': 'Wadi ad-Dawasir', 'واديالدواسر': 'Wadi ad-Dawasir', 'وادي الدواسر': 'Wadi ad-Dawasir',
    'hafr al batin': 'Hafar Al-Batin', 'hafralbatin': 'Hafar Al-Batin', 'hafaralbatin': 'Hafar Al-Batin', 'حفرالباطن': 'Hafar Al-Batin', 'حفر الباطن': 'Hafar Al-Batin',
    'khafji': 'Khafji', 'الخفجي': 'Khafji',
    'arar': 'Arar', 'عرعر': 'Arar',
    'sakaka': 'Sakaka', 'سكاكا': 'Sakaka',
    'qurayyat': 'Al Qurayyat', 'alqurayyat': 'Al Qurayyat', 'al qurayyat': 'Al Qurayyat', 'القريات': 'Al Qurayyat',
    'rafha': 'Rafha', 'رفحاء': 'Rafha', 'رفحا': 'Rafha',
    'turaif': 'Turaif', 'طريف': 'Turaif',
    'bisha': 'Bisha', 'بيشة': 'Bisha', 'بيشه': 'Bisha',
    'albahah': 'Al Bahah', 'al bahah': 'Al Bahah', 'الباحة': 'Al Bahah', 'الباحه': 'Al Bahah',
    'baljurashi': 'Baljurashi', 'بلجرشي': 'Baljurashi',
    'qunfudhah': 'Al Qunfudhah', 'alqunfudhah': 'Al Qunfudhah', 'al qunfudhah': 'Al Qunfudhah', 'القنفذة': 'Al Qunfudhah', 'القنفذه': 'Al Qunfudhah',
    'lith': 'Al Lith', 'allith': 'Al Lith', 'al lith': 'Al Lith', 'الليث': 'Al Lith',
    'rabigh': 'Rabigh', 'رابغ': 'Rabigh',
    'bahrah': 'Bahrah', 'بحرة': 'Bahrah', 'بحره': 'Bahrah',
    'diriyah': 'Diriyah', ' الدرعية': 'Diriyah', 'الدرعية': 'Diriyah', 'الدرعيه': 'Diriyah',
    'duba': 'Duba', 'ضباء': 'Duba', 'ضبا': 'Duba',
    'umluj': 'Umluj', 'املج': 'Umluj', 'أملج': 'Umluj',
    'alula': 'Al Ula', 'al ula': 'Al Ula', 'العلا': 'Al Ula',
  };

  const matched = cityMap[key] || cityMap[key.replace(/\s+/g, '')];
  if (matched) return { input, city: matched, matched: true };

  return { input, city: toTitleCase(input), matched: false };
}

function normalizeCityKey(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ءؤئ]/g, '')
    .replace(/[ـ]/g, '')
    .replace(/[.,،؛:()\[\]{}]/g, ' ')
    .replace(/\b(city|province|region|area|saudi arabia|ksa|sa)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTitleCase(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part)
    .join(' ');
}

function buildCityInfo(origin: NormalizedCity, destination: NormalizedCity) {
  return {
    origin: { input: origin.input, normalized: origin.city, matched: origin.matched },
    destination: { input: destination.input, normalized: destination.city, matched: destination.matched },
  };
}

function extractOtoMessage(data: any) {
  if (!data) return '';
  if (typeof data.message === 'string') return data.message;
  if (typeof data.error === 'string') return data.error;
  if (Array.isArray(data.errors) && data.errors[0]?.message) return data.errors[0].message;
  if (typeof data.data?.message === 'string') return data.data.message;
  return '';
}

function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
