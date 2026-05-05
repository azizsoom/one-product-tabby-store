'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    TabbyPromo?: any;
  }
}

type Props = {
  price: number;
  source?: 'product' | 'cart';
};

const publicKey = process.env.NEXT_PUBLIC_TABBY_PUBLIC_KEY || '';
const merchantCode = process.env.NEXT_PUBLIC_TABBY_MERCHANT_CODE || 'kuredais';

export default function TabbyPromoWidget({ price, source = 'cart' }: Props) {
  useEffect(() => {
    const selector = '#TabbyPromo';
    const container = document.querySelector(selector);
    if (!container || !publicKey || price <= 0) return;

    container.innerHTML = '';

    function renderPromo() {
      if (!window.TabbyPromo) return;
      container.innerHTML = '';
      new window.TabbyPromo({
        selector,
        currency: 'SAR',
        price: Number(price || 0).toFixed(2),
        lang: 'ar',
        source,
        shouldInheritBg: false,
        publicKey,
        merchantCode,
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
  }, [price, source]);

  if (!publicKey || price <= 0) {
    return null;
  }

  return <div id="TabbyPromo" />;
}
