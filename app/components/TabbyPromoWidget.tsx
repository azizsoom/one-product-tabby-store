'use client';

import { useEffect, useId, useState } from 'react';
import { db } from '../../lib/db';

declare global {
  interface Window {
    TabbyPromo?: any;
  }
}

type Props = {
  price: number;
  source?: 'product' | 'cart';
};

type TabbySettings = {
  publicKey: string;
  merchantCode: string;
};

const fallbackPublicKey = process.env.NEXT_PUBLIC_TABBY_PUBLIC_KEY || '';
const fallbackMerchantCode = process.env.NEXT_PUBLIC_TABBY_MERCHANT_CODE || 'kuredais';

export default function TabbyPromoWidget({ price, source = 'cart' }: Props) {
  const id = useId().replace(/:/g, '');
  const selector = `#tabby-promo-${id}`;
  const [settings, setSettings] = useState<TabbySettings>({
    publicKey: fallbackPublicKey,
    merchantCode: fallbackMerchantCode,
  });

  useEffect(() => {
    async function loadSettings() {
      const { data } = await db
        .from('store_settings')
        .select('key,value')
        .in('key', ['tabby_public_key', 'tabby_merchant_code']);

      const rows: Record<string, string> = {};
      (data || []).forEach((row: any) => {
        rows[row.key] = row.value || '';
      });

      setSettings({
        publicKey: rows.tabby_public_key || fallbackPublicKey,
        merchantCode: rows.tabby_merchant_code || fallbackMerchantCode,
      });
    }

    loadSettings();
  }, []);

  useEffect(() => {
    const container = document.querySelector(selector);
    if (!container || !settings.publicKey || price <= 0) return;

    container.innerHTML = '';

    function renderPromo() {
      if (!window.TabbyPromo) return;
      const element = document.querySelector(selector);
      if (!element) return;
      element.innerHTML = '';
      new window.TabbyPromo({
        selector,
        currency: 'SAR',
        price: Number(price || 0).toFixed(2),
        lang: 'ar',
        source,
        shouldInheritBg: false,
        publicKey: settings.publicKey,
        merchantCode: settings.merchantCode,
      });
    }

    const existingScript = document.querySelector('script[data-tabby-promo="true"]');
    if (existingScript) {
      renderPromo();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.tabby.sa/tabby-promo.js';
    script.async = true;
    script.dataset.tabbyPromo = 'true';
    script.onload = renderPromo;
    document.body.appendChild(script);
  }, [price, source, selector, settings.publicKey, settings.merchantCode]);

  if (price <= 0) return null;

  if (!settings.publicKey) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        أضف مفتاح تابي العام من إعدادات المتجر لظهور أداة التقسيط الرسمية.
      </div>
    );
  }

  return <div id={`tabby-promo-${id}`} className="overflow-hidden rounded-2xl bg-white" />;
}
