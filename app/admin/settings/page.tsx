'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '../../../lib/db';

type Setting = { key: string; value: string };
const TAMARA_TEST_URL = 'https://api-sandbox.tamara.co';
const TAMARA_LIVE_URL = 'https://api.tamara.co';

const defaults: Record<string, string> = {
  store_name: 'شركة المطارة',
  store_logo_url: '',
  store_email: 'az@kco.sa',
  store_phone: '0555868221',
  store_city: 'الرياض',
  vat_number: '300339747477747',
  footer_text: 'شركة المطارة - الرياض',
  tabby_public_key: '',
  tabby_secret_key: '',
  tabby_merchant_code: 'kuredais',
  tabby_api_url: 'https://api.tabby.sa/api/v2/checkout',
  tabby_mode: 'test',
  tamara_enabled: 'false',
  tamara_api_token: '',
  tamara_api_url: TAMARA_TEST_URL,
  tamara_notification_token: '',
  tamara_mode: 'test',
  oto_enabled: 'false',
  oto_refresh_token: '',
  oto_origin_city: 'Riyadh',
  oto_origin_country: 'SA',
  oto_volumetric_divisor: '5000',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaults);
  const [message, setMessage] = useState('');

  useEffect(() => { loadSettings(); }, []);

  function setTamaraMode(mode: string) {
    setSettings({
      ...settings,
      tamara_mode: mode,
      tamara_api_url: mode === 'live' ? TAMARA_LIVE_URL : TAMARA_TEST_URL,
    });
  }

  async function loadSettings() {
    const { data } = await db.from('store_settings').select('*');
    if (data) {
      const next = { ...defaults };
      (data as Setting[]).forEach((row) => { next[row.key] = row.value || ''; });
      if (!next.tamara_api_url) next.tamara_api_url = next.tamara_mode === 'live' ? TAMARA_LIVE_URL : TAMARA_TEST_URL;
      setSettings(next);
    }
  }

  async function uploadLogo(file: File) {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) return setMessage('صيغة الشعار غير مدعومة. استخدم PNG أو JPG أو WEBP أو SVG.');
    if (file.size > 3 * 1024 * 1024) return setMessage('حجم الشعار كبير. الحد الأقصى 3MB.');
    const extension = file.name.split('.').pop() || 'png';
    const filePath = `logos/store-logo-${Date.now()}.${extension}`;
    const { error } = await db.storage.from('product-images').upload(filePath, file, { cacheControl: '3600', upsert: true });
    if (error) return setMessage('فشل رفع الشعار: ' + error.message);
    const { data } = db.storage.from('product-images').getPublicUrl(filePath);
    setSettings({ ...settings, store_logo_url: data.publicUrl });
    setMessage('تم رفع الشعار. اضغط حفظ الإعدادات لاعتماده.');
  }

  async function saveSettings() {
    setMessage('');
    const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const { error } = await db.from('store_settings').upsert(rows, { onConflict: 'key' });
    setMessage(error ? 'فشل الحفظ: ' + error.message : 'تم حفظ إعدادات المتجر.');
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6 text-stone-950" dir="rtl">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="text-sm text-emerald-700">الرجوع للوحة التحكم</Link>
        <h1 className="mt-4 text-3xl font-black">إعدادات المتجر</h1>
        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="اسم المتجر" value={settings.store_name} onChange={(v) => setSettings({ ...settings, store_name: v })} />
            <Field label="البريد الإلكتروني" value={settings.store_email} onChange={(v) => setSettings({ ...settings, store_email: v })} />
            <Field label="رقم الجوال / واتساب" value={settings.store_phone} onChange={(v) => setSettings({ ...settings, store_phone: v })} />
            <Field label="المدينة" value={settings.store_city} onChange={(v) => setSettings({ ...settings, store_city: v })} />
            <Field label="الرقم الضريبي" value={settings.vat_number} onChange={(v) => setSettings({ ...settings, vat_number: v })} />
            <Field label="نص الفوتر" value={settings.footer_text} onChange={(v) => setSettings({ ...settings, footer_text: v })} />
          </div>

          <div className="mt-6 rounded-3xl bg-stone-50 p-5 ring-1 ring-stone-200">
            <h2 className="text-xl font-black">شعار المتجر</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label><span className="mb-2 block text-sm font-bold text-stone-700">رفع شعار من الجهاز</span><input className="input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} /></label>
              <Field label="رابط الشعار" value={settings.store_logo_url} onChange={(v) => setSettings({ ...settings, store_logo_url: v })} />
            </div>
            {settings.store_logo_url ? <div className="mt-4 rounded-2xl bg-white p-4 text-center ring-1 ring-stone-200"><img src={settings.store_logo_url} alt="شعار المتجر" className="mx-auto max-h-28 object-contain" /></div> : null}
          </div>

          <div className="mt-6 rounded-3xl bg-violet-50 p-5 ring-1 ring-violet-100">
            <h2 className="text-xl font-black text-violet-950">إعدادات الربط مع تابي</h2>
            <p className="mt-2 text-sm leading-6 text-violet-800">تقدر تعدل مفاتيح تابي من هنا. في التشغيل الحقيقي يفضل الاحتفاظ بالمفتاح السري داخل Vercel.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="مفتاح تابي العام Public Key" value={settings.tabby_public_key} onChange={(v) => setSettings({ ...settings, tabby_public_key: v })} placeholder="pk_test_..." />
              <Field label="رمز التاجر Merchant Code" value={settings.tabby_merchant_code} onChange={(v) => setSettings({ ...settings, tabby_merchant_code: v })} placeholder="kuredais" />
              <Field label="رابط API تابي" value={settings.tabby_api_url} onChange={(v) => setSettings({ ...settings, tabby_api_url: v })} placeholder="https://api.tabby.sa/api/v2/checkout" />
              <label><span className="mb-2 block text-sm font-bold text-stone-700">وضع الربط</span><select className="input" value={settings.tabby_mode} onChange={(e) => setSettings({ ...settings, tabby_mode: e.target.value })}><option value="test">تجريبي test</option><option value="live">فعلي live</option></select></label>
              <Field label="مفتاح تابي السري Secret Key" type="password" value={settings.tabby_secret_key} onChange={(v) => setSettings({ ...settings, tabby_secret_key: v })} placeholder="sk_test_..." />
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
            <h2 className="text-xl font-black text-emerald-950">إعدادات الربط مع Tamara</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">اختيار الوضع يغير رابط API تلقائيًا: تجريبي sandbox أو فعلي production.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-emerald-100"><input type="checkbox" checked={settings.tamara_enabled === 'true'} onChange={(e) => setSettings({ ...settings, tamara_enabled: e.target.checked ? 'true' : 'false' })} /><span className="font-bold">تفعيل Tamara</span></label>
              <label><span className="mb-2 block text-sm font-bold text-stone-700">وضع الربط</span><select className="input" value={settings.tamara_mode} onChange={(e) => setTamaraMode(e.target.value)}><option value="test">تجريبي test</option><option value="live">فعلي live</option></select></label>
              <Field label="رابط API Tamara يتغير تلقائيًا" value={settings.tamara_api_url} onChange={(v) => setSettings({ ...settings, tamara_api_url: v })} placeholder={TAMARA_TEST_URL} />
              <Field label="Tamara API Token" type="password" value={settings.tamara_api_token} onChange={(v) => setSettings({ ...settings, tamara_api_token: v })} placeholder="ضع التوكن هنا" />
              <Field label="Tamara Notification Token" type="password" value={settings.tamara_notification_token} onChange={(v) => setSettings({ ...settings, tamara_notification_token: v })} placeholder="اختياري للويب هوك" />
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-sky-50 p-5 ring-1 ring-sky-100">
            <h2 className="text-xl font-black text-sky-950">إعدادات الشحن عبر OTO</h2>
            <p className="mt-2 text-sm leading-6 text-sky-800">OTO يربط المتجر بعدة شركات شحن ويحسب السعر حسب المدينة والوزن والأبعاد. إذا لم تضف التوكن يستخدم النظام سعر الشحن الاحتياطي من المنتج.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-sky-100"><input type="checkbox" checked={settings.oto_enabled === 'true'} onChange={(e) => setSettings({ ...settings, oto_enabled: e.target.checked ? 'true' : 'false' })} /><span className="font-bold">تفعيل ربط OTO</span></label>
              <Field label="OTO Refresh Token" type="password" value={settings.oto_refresh_token} onChange={(v) => setSettings({ ...settings, oto_refresh_token: v })} placeholder="ضع Refresh Token من لوحة OTO" />
              <Field label="مدينة الإرسال" value={settings.oto_origin_city} onChange={(v) => setSettings({ ...settings, oto_origin_city: v })} placeholder="Riyadh" />
              <Field label="دولة الإرسال" value={settings.oto_origin_country} onChange={(v) => setSettings({ ...settings, oto_origin_country: v })} placeholder="SA" />
              <Field label="معامل الوزن الحجمي" type="number" value={settings.oto_volumetric_divisor} onChange={(v) => setSettings({ ...settings, oto_volumetric_divisor: v })} placeholder="5000" />
            </div>
          </div>

          {message ? <p className="mt-4 rounded-2xl bg-stone-100 p-3 text-sm">{message}</p> : null}
          <button onClick={saveSettings} className="mt-6 rounded-2xl bg-emerald-600 px-6 py-3 font-bold text-white">حفظ الإعدادات</button>
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, placeholder = '', type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label><span className="mb-2 block text-sm font-bold text-stone-700">{label}</span><input className="input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}
