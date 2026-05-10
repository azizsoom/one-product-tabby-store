'use client';

import { useEffect, useRef, useState } from 'react';

type MapAddress = { city?: string; district?: string; street?: string; postalCode?: string; lat: number; lng: number };

type Props = {
  onChange: (address: MapAddress) => void;
};

const DEFAULT_LAT = 24.7136;
const DEFAULT_LNG = 46.6753;

export default function MapPicker({ onChange }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [coords, setCoords] = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadLeaflet() {
      if (typeof window === 'undefined' || !mapRef.current) return;
      await ensureLeaflet();
      if (cancelled || !mapRef.current) return;
      const L = (window as any).L;
      if (!L || leafletMapRef.current) return;
      const map = L.map(mapRef.current).setView([coords.lat, coords.lng], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
      const marker = L.marker([coords.lat, coords.lng], { draggable: true }).addTo(map);
      marker.on('dragend', async () => {
        const point = marker.getLatLng();
        await updateLocation(point.lat, point.lng, false);
      });
      map.on('click', async (event: any) => {
        await updateLocation(event.latlng.lat, event.latlng.lng, true);
      });
      leafletMapRef.current = map;
      markerRef.current = marker;
      window.setTimeout(() => map.invalidateSize(), 250);
    }
    loadLeaflet();
    return () => { cancelled = true; };
  }, []);

  async function updateLocation(lat: number, lng: number, moveMarker: boolean) {
    const next = { lat: roundCoord(lat), lng: roundCoord(lng) };
    setCoords(next);
    if (moveMarker && markerRef.current) markerRef.current.setLatLng([next.lat, next.lng]);
    if (leafletMapRef.current) leafletMapRef.current.setView([next.lat, next.lng], Math.max(leafletMapRef.current.getZoom(), 14));
    setMessage('جاري قراءة بيانات الموقع...');
    const address = await reverseGeocode(next.lat, next.lng);
    onChange({ ...address, ...next });
    setMessage('تم تحديد الموقع. راجع بيانات العنوان قبل الدفع.');
  }

  function locateMe() {
    setMessage('جاري تحديد موقعك...');
    if (!navigator.geolocation) {
      setMessage('المتصفح لا يدعم تحديد الموقع. اختر الموقع يدويًا من الخريطة.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await updateLocation(position.coords.latitude, position.coords.longitude, true);
      },
      () => setMessage('تعذر تحديد موقعك. فعّل صلاحية الموقع أو اختره يدويًا من الخريطة.'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  return (
    <div className="rounded-3xl bg-stone-50 p-3 ring-1 ring-stone-200 md:col-span-2">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-black">تحديد الموقع على الخريطة</h3>
          <p className="mt-1 text-xs leading-5 text-stone-600">اضغط على الخريطة أو اسحب الدبوس. البيانات المعبأة من الخريطة للمساعدة فقط، والعنوان المختصر من سبل يبقى مهمًا.</p>
        </div>
        <button type="button" onClick={locateMe} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">حدد موقعي الحالي</button>
      </div>
      <div ref={mapRef} className="h-72 w-full overflow-hidden rounded-2xl bg-stone-200" />
      <div className="mt-2 flex flex-col gap-1 text-xs text-stone-600 sm:flex-row sm:justify-between">
        <span>الإحداثيات: {coords.lat}, {coords.lng}</span>
        {message ? <span className="font-bold text-emerald-700">{message}</span> : null}
      </div>
    </div>
  );
}

function ensureLeaflet() {
  return new Promise<void>((resolve, reject) => {
    if ((window as any).L) return resolve();
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-leaflet-css', 'true');
      document.head.appendChild(link);
    }
    const existing = document.querySelector('script[data-leaflet-js]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Leaflet load failed')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.setAttribute('data-leaflet-js', 'true');
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Leaflet load failed'));
    document.body.appendChild(script);
  });
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ar`);
    const data = await res.json();
    const a = data?.address || {};
    return {
      city: a.city || a.town || a.village || a.county || '',
      district: a.suburb || a.neighbourhood || a.quarter || a.city_district || '',
      street: a.road || a.pedestrian || '',
      postalCode: a.postcode || '',
    };
  } catch {
    return {};
  }
}

function roundCoord(value: number) {
  return Math.round(value * 1000000) / 1000000;
}
