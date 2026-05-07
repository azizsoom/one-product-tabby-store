'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, Truck } from 'lucide-react';
import TabbyPromoWidget from '../../components/TabbyPromoWidget';
import { CHECKOUT_DRAFT_KEY, CITY_GROUPS, SHIPPING_CITY_OPTIONS, getCityLabel, roundMoney } from '../constants';

type Product = { id:string; name:string; price_before_vat:number; shipping_amount:number; stock_quantity:number; image_url?:string|null };
type CartItem = { product:Product; quantity:number };
type DiscountCode = { code:string; type:'percentage'|'fixed'; value:number; max_discount_amount:number|null };
type ShippingOption = { id:string; deliveryOptionId:string|null; company:string; service:string; price:number; currency:string; eta:string; raw?:any };
type Draft = { items:CartItem[]; customerName:string; customerMobile:string; customerEmail:string; discountCode:string; appliedDiscount:DiscountCode|null };

export default function ShippingCheckoutPage(){
  const [draft,setDraft]=useState<Draft|null>(null);
  const [fulfillment,setFulfillment]=useState<'shipping'|'pickup'>('shipping');
  const [city,setCity]=useState('Riyadh');
  const [district,setDistrict]=useState('');
  const [shortAddress,setShortAddress]=useState('');
  const [building,setBuilding]=useState('');
  const [street,setStreet]=useState('');
  const [postal,setPostal]=useState('');
  const [additional,setAdditional]=useState('');
  const [notes,setNotes]=useState('');
  const [options,setOptions]=useState<ShippingOption[]>([]);
  const [selected,setSelected]=useState<ShippingOption|null>(null);
  const [msg,setMsg]=useState('');
  const [loading,setLoading]=useState(false);
  const [paying,setPaying]=useState(false);

  useEffect(()=>{ try{const raw=localStorage.getItem(CHECKOUT_DRAFT_KEY); if(raw)setDraft(JSON.parse(raw));}catch{} },[]);
  useEffect(()=>{setOptions([]);setSelected(null);setMsg('');},[city,fulfillment,draft?.items?.length]);
  const totals=useMemo(()=>calcTotals(draft?.items||[],draft?.appliedDiscount||null,fulfillment,selected),[draft,fulfillment,selected]);
  const nationalAddress=[`العنوان المختصر: ${shortAddress}`,`المدينة: ${getCityLabel(city)}`,`الحي: ${district}`,`الشارع: ${street}`,`رقم المبنى: ${building}`,`الرمز البريدي: ${postal}`,`الرقم الإضافي: ${additional}`].filter(x=>!x.endsWith(': ')).join(' - ');

  async function fetchRates(){
    setMsg('');setOptions([]);setSelected(null);
    if(!draft||draft.items.length===0)return setMsg('لا توجد سلة محفوظة. ارجع للمتجر وأضف المنتجات.');
    if(fulfillment==='pickup')return setMsg('تم اختيار الاستلام من الفرع ولا يوجد شحن.');
    if(!city||!district.trim()||!shortAddress.trim())return setMsg('اختر المدينة واكتب الحي والعنوان المختصر من سبل أولاً.');
    setLoading(true);
    const res=await fetch('/api/shipping/oto-rates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destinationCity:city,destinationCountry:'SA',items:draft.items.map(i=>({productId:i.product.id,quantity:i.quantity}))})});
    const data=await res.json().catch(()=>({})); setLoading(false);
    if(!res.ok)return setMsg(data.error||'تعذر حساب الشحن.');
    const list=Array.isArray(data.options)?data.options:[]; setOptions(list); if(list[0])setSelected(list[0]); setMsg(data.warning||`تم جلب ${list.length} خيار شحن إلى ${getCityLabel(city)}.`);
  }

  async function pay(){
    setMsg(''); if(!draft)return setMsg('لا توجد بيانات طلب محفوظة.');
    if(fulfillment==='shipping'){
      if(!city||!district.trim()||!shortAddress.trim()||!building.trim()||!street.trim()||!postal.trim())return setMsg('أكمل العنوان الوطني: المدينة، الحي، العنوان المختصر، رقم المبنى، الشارع، الرمز البريدي.');
      if(!selected)return setMsg('احسب الشحن واختر شركة الشحن قبل الدفع.');
    }
    setPaying(true);
    const res=await fetch('/api/checkout/tabby',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:draft.items.map(i=>({productId:i.product.id,quantity:i.quantity})),customerName:draft.customerName,customerMobile:draft.customerMobile,customerEmail:draft.customerEmail,discountCode:draft.discountCode||'',shippingInfo:{fulfillmentType:fulfillment,city,cityLabel:getCityLabel(city),district,address:nationalAddress,shortAddress,buildingNumber:building,street,postalCode:postal,additionalNumber:additional,notes,selectedOption:selected}})});
    const data=await res.json().catch(()=>({})); setPaying(false);
    if(!res.ok||!data.webUrl)return setMsg('تعذر إنشاء دفع تابي: '+(data.error||data.details?.message||'خطأ غير معروف'));
    window.location.href=data.webUrl;
  }

  if(!draft)return <main dir="rtl" className="min-h-screen bg-stone-50 p-6"><div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 text-center ring-1 ring-stone-200"><h1 className="text-2xl font-black">لا توجد بيانات طلب</h1><p className="mt-2 text-stone-600">ارجع للمتجر وأضف المنتجات ثم تابع للشحن.</p><Link href="/" className="mt-4 inline-block rounded-2xl bg-stone-950 px-5 py-3 font-bold text-white">الرجوع للمتجر</Link></div></main>;

  return <main dir="rtl" className="min-h-screen bg-stone-50 p-4 text-stone-950"><div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1fr_380px]">
    <section className="space-y-4"><div className="rounded-[2rem] bg-white p-5 ring-1 ring-stone-200"><h1 className="text-3xl font-black">بيانات الشحن والعنوان الوطني</h1><p className="mt-2 text-sm text-stone-600">اكتب العنوان المختصر من سبل وبيانات العنوان الوطني لتظهر في بوليصة الشحن.</p></div>
      <div className="rounded-[2rem] bg-white p-5 ring-1 ring-stone-200"><h2 className="font-black">طريقة الاستلام</h2><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>setFulfillment('shipping')} className={`rounded-2xl px-4 py-3 font-bold ${fulfillment==='shipping'?'bg-emerald-600 text-white':'bg-stone-100'}`}>شحن للعنوان</button><button onClick={()=>setFulfillment('pickup')} className={`rounded-2xl px-4 py-3 font-bold ${fulfillment==='pickup'?'bg-emerald-600 text-white':'bg-stone-100'}`}>استلام من الفرع</button></div></div>
      {fulfillment==='shipping'?<div className="rounded-[2rem] bg-white p-5 ring-1 ring-stone-200"><h2 className="font-black">العنوان الوطني / سبل</h2><div className="mt-3 grid gap-3 md:grid-cols-2"><select className="input" value={city} onChange={e=>setCity(e.target.value)}>{CITY_GROUPS.map(r=><optgroup key={r} label={r}>{SHIPPING_CITY_OPTIONS.filter(c=>c.region===r).map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</optgroup>)}</select><input className="input" placeholder="الحي" value={district} onChange={e=>setDistrict(e.target.value)}/><input className="input md:col-span-2" placeholder="العنوان المختصر من سبل مثال: RDBA1234" value={shortAddress} onChange={e=>setShortAddress(e.target.value.toUpperCase())}/><input className="input" placeholder="رقم المبنى" value={building} onChange={e=>setBuilding(e.target.value)}/><input className="input" placeholder="اسم الشارع" value={street} onChange={e=>setStreet(e.target.value)}/><input className="input" placeholder="الرمز البريدي" value={postal} onChange={e=>setPostal(e.target.value)}/><input className="input" placeholder="الرقم الإضافي اختياري" value={additional} onChange={e=>setAdditional(e.target.value)}/><textarea className="input min-h-20 md:col-span-2" placeholder="ملاحظات للمندوب اختياري" value={notes} onChange={e=>setNotes(e.target.value)}/></div><button onClick={fetchRates} disabled={loading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 py-3 font-black text-white disabled:opacity-50"><Truck size={18}/>{loading?'جاري حساب الشحن':'حساب خيارات الشحن'}</button>{msg?<p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{msg}</p>:null}{options.length>0?<div className="mt-4 grid gap-2">{options.map(o=><button key={o.id} onClick={()=>setSelected(o)} className={`rounded-2xl p-3 text-right ring-1 ${selected?.id===o.id?'bg-emerald-50 ring-emerald-500':'bg-white ring-stone-200'}`}><div className="flex justify-between gap-2"><b>{o.company}</b><b>{Number(o.price||0).toFixed(2)} {o.currency||'SAR'}</b></div><p className="mt-1 text-xs text-stone-500">{o.service}{o.eta?` - ${o.eta}`:''}</p></button>)}</div>:null}</div>:<div className="rounded-[2rem] bg-white p-5 ring-1 ring-stone-200">سيتم تجهيز الطلب للاستلام من الفرع ولا يتم احتساب الشحن.</div>}
    </section>
    <aside className="h-fit rounded-[2rem] bg-white p-5 ring-1 ring-stone-200"><h2 className="text-xl font-black">ملخص الطلب</h2><div className="mt-3 space-y-2">{draft.items.map(i=><div key={i.product.id} className="flex justify-between gap-2 text-sm"><span>{i.product.name} × {i.quantity}</span><b>{(Number(i.product.price_before_vat)*i.quantity).toFixed(2)}</b></div>)}</div><div className="mt-4 border-t pt-3"><Row label="المجموع" value={`${totals.subtotal.toFixed(2)} ريال`}/><Row label="الخصم" value={`-${totals.discountAmount.toFixed(2)} ريال`}/><Row label="الضريبة 15%" value={`${totals.vat.toFixed(2)} ريال`}/><Row label="الشحن" value={totals.shipping===0?'مجاني':`${totals.shipping.toFixed(2)} ريال`}/><div className="mt-3 rounded-2xl bg-stone-950 p-4 text-center text-2xl font-black text-white">{totals.total.toFixed(2)} ريال</div></div><div className="mt-3"><TabbyPromoWidget price={totals.total} source="checkout"/></div>{msg&&fulfillment==='pickup'?<p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{msg}</p>:null}<button onClick={pay} disabled={paying} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-lg font-black text-white disabled:opacity-50"><ShoppingBag size={20}/>{paying?'جاري التحويل لتابي':'الدفع عبر تابي'}</button><Link href="/" className="mt-3 block text-center text-sm font-bold text-stone-500">الرجوع للسلة</Link></aside>
  </div></main>;
}

function calcTotals(cart:CartItem[],discount:DiscountCode|null,fulfillment:'shipping'|'pickup',selected:ShippingOption|null){const subtotal=roundMoney(cart.reduce((s,i)=>s+Number(i.product.price_before_vat||0)*i.quantity,0));const raw=discount?(discount.type==='percentage'?subtotal*(Number(discount.value||0)/100):Number(discount.value||0)):0;const cap=discount?.max_discount_amount?Math.min(raw,Number(discount.max_discount_amount)):raw;const discountAmount=roundMoney(Math.min(subtotal,Math.max(0,cap)));const taxable=roundMoney(subtotal-discountAmount);const vat=roundMoney(taxable*.15);const shipping=fulfillment==='pickup'?0:roundMoney(selected?Number(selected.price||0):0);const total=roundMoney(taxable+vat+shipping);return{subtotal,discountAmount,taxable,vat,shipping,total};}
function Row({label,value}:{label:string;value:string}){return <div className="flex justify-between py-1 text-sm"><span className="text-stone-500">{label}</span><b>{value}</b></div>}
