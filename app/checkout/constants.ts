export const CHECKOUT_DRAFT_KEY = 'one-product-tabby-store-checkout-draft-v1';

export type CityOption = { label: string; value: string; region: string };

export const SHIPPING_CITY_OPTIONS: CityOption[] = [
  { label: 'الرياض', value: 'Riyadh', region: 'الوسطى' },
  { label: 'الخرج', value: 'Al Kharj', region: 'الوسطى' },
  { label: 'جدة', value: 'Jeddah', region: 'الغربية' },
  { label: 'مكة', value: 'Makkah', region: 'الغربية' },
  { label: 'المدينة المنورة', value: 'Madinah', region: 'الغربية' },
  { label: 'الطائف', value: 'Taif', region: 'الغربية' },
  { label: 'ينبع', value: 'Yanbu', region: 'الغربية' },
  { label: 'الدمام', value: 'Dammam', region: 'الشرقية' },
  { label: 'الخبر', value: 'Khobar', region: 'الشرقية' },
  { label: 'الجبيل', value: 'Jubail', region: 'الشرقية' },
  { label: 'الأحساء', value: 'Al Ahsa', region: 'الشرقية' },
  { label: 'بريدة', value: 'Buraidah', region: 'القصيم' },
  { label: 'عنيزة', value: 'Unaizah', region: 'القصيم' },
  { label: 'الرس', value: 'ar rass', region: 'القصيم' },
  { label: 'حائل', value: 'Hail', region: 'الشمال' },
  { label: 'تبوك', value: 'Tabuk', region: 'الشمال' },
  { label: 'عرعر', value: 'Arar', region: 'الشمال' },
  { label: 'سكاكا', value: 'Sakaka', region: 'الشمال' },
  { label: 'القريات', value: 'Al Qurayyat', region: 'الشمال' },
  { label: 'أبها', value: 'Abha', region: 'الجنوب' },
  { label: 'خميس مشيط', value: 'Khamis Mushait', region: 'الجنوب' },
  { label: 'جازان', value: 'Jazan', region: 'الجنوب' },
  { label: 'نجران', value: 'Najran', region: 'الجنوب' },
  { label: 'الباحة', value: 'Al Bahah', region: 'الجنوب' },
];

export const CITY_GROUPS = Array.from(new Set(SHIPPING_CITY_OPTIONS.map((city) => city.region)));
export function getCityLabel(value: string) { return SHIPPING_CITY_OPTIONS.find((city) => city.value === value)?.label || value; }
export function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
