'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { db } from '../../lib/db';
import TabbyPromoWidget from './TabbyPromoWidget';
import { CHECKOUT_DRAFT_KEY, roundMoney } from '../checkout/constants';

type Product = { id:string; name:string; description:string|null; price_before_vat:number; shipping_amount:number; stock_quantity:number; image_url:string|null; created_at?:string };
type CartItem = { product: Product; quantity: number };
type DiscountCode = { code:string; type:'percentage'|'fixed'; value:number; max_discount_amount:number|null; is_active:boolean; usage_limit:number|null; used_count:number };
type FlyItem = { id:number; fromX:number; fromY:number; toX:number; toY:number; emoji:string };

export default function StorefrontCheckoutLite() {
  const router = useRouter();
  const cartButtonRef = useRef<HTMLButtonElement|null>(null);
  const flyCounterRef = useRef(1);
  const [products,setProducts]=useState<Product[]>([]);
  const [cart,setCart]=useState<CartItem[]>([]);
  const [open,setOpen]=useState(false);
  const [search,setSearch]=useState('');
  const [sortBy,setSortBy]=useState('newest');
  const [name,setName]=useState('Test User');
  const [mobile,setMobile]=useState('+966500000001');
  const [email,setEmail]=useState('otp.success@tabby.ai');
  const [discountCode,setDiscountCode]=useState('');
  const [discount,setDiscount]=useState<DiscountCode|null>(null);
  const [msg,setMsg]=useState('');
  const [discountMsg,setDiscountMsg]=useState('');
  const [flyItems,setFlyItems]=useState<FlyItem[]>([]);

  useEffect(()=>{ db.from('products').select('*').eq('is_active',true).order('created_at',{ascending:false}).then(({data})=>setProducts((data||[]) as Product[])); },[]);
  useEffect(()=>{ document.body.style.overflow=open?'hidden':''; return()=>{document.body.style.overflow=''};},[open]);

  const visible=useMemo(()=>{ const q=search.trim().toLowerCase(); return products.filter(p=>!q||String(p.name).toLowerCase().includes(q)||String(p.description||'').toLowerCase().includes(q)).sort((a,b)=> sortBy==='price_low'?Number(a.price_before_vat)-Number(b.price_before_vat):sortBy==='price_high'?Number(b.price_before_vat)-Number(a.price_before_vat):Number(b.stock_quantity||0)-Number(a.stock_quantity||0));},[products,search,sortBy]);
  const totals=useMemo(()=>calcTotals(cart,discount),[cart,discount]);
  const qty=cart.reduce((s,i)=>s+i.quantity,0);

  function animateToCart(el?:HTMLElement|null){
    const from=el?.getBoundingClientRect(); const to=cartButtonRef.current?.getBoundingClientRect(); if(!from||!to)return;
    const id=flyCounterRef.current++;
    setFlyItems(items=>[...items,{id,fromX:from.left+from.width/2,fromY:from.top+from.height/2,toX:to.left+to.width/2,toY:to.top+to.height/2,emoji:'🛒'}]);
    window.setTimeout(()=>setFlyItems(items=>items.filter(i=>i.id!==id)),950);
  }

  function add(p:Product, el?:HTMLElement|null){ setMsg(''); const stock=Number(p.stock_quantity||0); if(stock<=0)return setMsg('هذا المنتج غير متوفر.'); let added=false; setCart(items=>{ const old=items.find(i=>i.product.id===p.id); if(old){ if(old.quantity>=stock){setMsg('الكمية المطلوبة أكبر من المتوفر.'); return items;} added=true; return items.map(i=>i.product.id===p.id?{...i,quantity:i.quantity+1}:i);} added=true; return [...items,{product:p,quantity:1}];}); if(added){animateToCart(el); setMsg('تمت إضافة المنتج للسلة. اضغط زر السلة لإكمال الطلب.');} }
  function changeQty(id:string,n:number){ setCart(items=>items.map(i=>i.product.id===id?{...i,quantity:Math.max(1,Math.min(Number(i.product.stock_quantity||1),Math.floor(n||1)))}:i)); }
  function remove(id:string){ setCart(items=>items.filter(i=>i.product.id!==id)); }

  async function applyDiscount(){ const code=discountCode.trim().toUpperCase(); setDiscount(null); setDiscountMsg(''); if(!code)return setDiscountMsg('اكتب كود الخصم أولاً.'); if(cart.length===0)return setDiscountMsg('أضف منتجات للسلة.'); const {data,error}=await db.from('discount_codes').select('*').eq('code',code).single(); const row=data as DiscountCode|null; if(error||!row||!row.is_active)return setDiscountMsg('كود الخصم غير صحيح أو غير فعال.'); if(row.usage_limit!==null&&Number(row.used_count||0)>=Number(row.usage_limit))return setDiscountMsg('كود الخصم تجاوز حد الاستخدام.'); setDiscount(row); setDiscountCode(row.code); setDiscountMsg('تم تطبيق كود الخصم.'); }
  function goShipping(){ setMsg(''); if(cart.length===0)return setMsg('السلة فارغة.'); if(!name.trim()||!mobile.trim()||!email.trim())return setMsg('أدخل الاسم والجوال والإيميل قبل المتابعة.'); if(!/^\S+@\S+\.\S+$/.test(email))return setMsg('صيغة الإيميل غير صحيحة.'); localStorage.setItem(CHECKOUT_DRAFT_KEY,JSON.stringify({items:cart,customerName:name.trim(),customerMobile:mobile.trim(),customerEmail:email.trim(),discountCode:discount?.code||'',appliedDiscount:discount,savedAt:new Date().toISOString()})); router.push('/checkout/shipping'); }

  return <main dir="rtl" className="min-h-screen bg-stone-50 text-stone-950">
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4 lg:px-6"><h1 className="text-base font-black sm:text-xl lg:text-2xl">المتجر الإلكتروني</h1><button ref={cartButtonRef} onClick={()=>setOpen(true)} className="relative rounded-2xl bg-stone-950 px-4 py-3 text-sm font-bold text-white shadow-sm sm:px-6">السلة <span className="mr-1 rounded-full bg-emerald-500 px-2 py-0.5 text-xs">{qty}</span></button></div></header>
    <section className="mx-auto max-w-7xl px-3 py-4 sm:px-4 lg:px-6 lg:py-8">
      <div className="mb-4 rounded-[1.5rem] bg-stone-950 p-4 text-white sm:rounded-[2rem] sm:p-6 lg:p-8"><h2 className="text-2xl font-black sm:text-3xl lg:text-5xl">اختر منتجاتك</h2><p className="mt-2 text-sm leading-6 text-stone-200 sm:text-base">بعد السلة تنتقل لصفحة العنوان الوطني وخيارات الشحن.</p></div>
      <div className="mb-4 grid gap-3 rounded-3xl bg-white p-3 ring-1 ring-stone-200 sm:p-4 md:grid-cols-[1fr_220px]"><input className="input" placeholder="بحث عن منتج" value={search} onChange={e=>setSearch(e.target.value)}/><select className="input" value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="newest">الأحدث</option><option value="price_low">الأقل سعر</option><option value="price_high">الأعلى سعر</option><option value="stock">الأكثر توفر</option></select></div>
      {msg&&!open?<p className="mb-4 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900 ring-1 ring-emerald-200">{msg}</p>:null}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{visible.map(p=><div key={p.id} className="group flex h-full flex-col rounded-2xl bg-white p-2 shadow-sm ring-1 ring-stone-200 transition hover:-translate-y-1 hover:shadow-lg sm:rounded-3xl sm:p-3"><div className="aspect-square overflow-hidden rounded-2xl bg-stone-100">{p.image_url?<img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105"/>:null}</div><h3 className="mt-2 line-clamp-2 min-h-9 text-xs font-black leading-5 sm:mt-3 sm:min-h-10 sm:text-sm">{p.name}</h3><p className="mt-auto pt-2 text-center text-xl font-black sm:text-2xl">{Number(p.price_before_vat||0).toFixed(0)} <span className="text-[10px] sm:text-xs">ريال</span></p><button onClick={(e)=>add(p,e.currentTarget)} disabled={Number(p.stock_quantity||0)<=0} className="mt-2 w-full rounded-2xl bg-emerald-600 py-2.5 text-xs font-black text-white transition active:scale-95 disabled:bg-stone-300 sm:mt-3 sm:py-3 sm:text-sm">إضافة للسلة</button></div>)}</div>
    </section>
    {flyItems.map(item=><span key={item.id} className="pointer-events-none fixed z-[9999] text-4xl drop-shadow-xl" style={{left:item.fromX,top:item.fromY,transform:'translate(-50%,-50%)',animation:`flyCart${item.id} 900ms cubic-bezier(.22,1,.36,1) forwards`}}>{item.emoji}<style>{`@keyframes flyCart${item.id}{0%{left:${item.fromX}px;top:${item.fromY}px;opacity:1;transform:translate(-50%,-50%) scale(1)}65%{opacity:1;transform:translate(-50%,-50%) scale(1.35)}100%{left:${item.toX}px;top:${item.toY}px;opacity:0;transform:translate(-50%,-50%) scale(.25)}}`}</style></span>)}
    {open?<div className="fixed inset-0 z-50"><button className="absolute inset-0 bg-black/40" onClick={()=>setOpen(false)}/><aside className="absolute left-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl sm:rounded-r-[2rem]"><div className="border-b p-4"><h2 className="text-2xl font-black">سلة المشتريات</h2></div><div className="flex-1 overflow-auto p-4">
      {cart.length===0?<p className="rounded-3xl bg-stone-50 p-6 text-center">السلة فارغة</p>:<div className="space-y-3">{cart.map(i=><div key={i.product.id} className="rounded-3xl border p-3"><div className="flex gap-3"><div className="h-16 w-16 overflow-hidden rounded-2xl bg-stone-100">{i.product.image_url?<img src={i.product.image_url} className="h-full w-full object-cover" alt=""/>:null}</div><div className="flex-1"><h3 className="font-black">{i.product.name}</h3><p className="text-sm text-stone-500">{Number(i.product.price_before_vat).toFixed(2)} ريال</p></div><button onClick={()=>remove(i.product.id)} className="text-red-600"><Trash2 size={18}/></button></div><div className="mt-3 flex items-center gap-2"><button onClick={()=>changeQty(i.product.id,i.quantity-1)} className="h-9 w-9 rounded-xl bg-stone-100">-</button><input className="input max-w-20 text-center" type="number" value={i.quantity} onChange={e=>changeQty(i.product.id,Number(e.target.value))}/><button onClick={()=>changeQty(i.product.id,i.quantity+1)} className="h-9 w-9 rounded-xl bg-stone-100">+</button></div></div>)}</div>}
      <div className="mt-4 rounded-3xl bg-stone-50 p-4 ring-1 ring-stone-200"><h3 className="font-black">كود الخصم</h3><div className="mt-2 flex gap-2"><input className="input" value={discountCode} onChange={e=>setDiscountCode(e.target.value)} placeholder="SAVE10"/><button onClick={applyDiscount} className="rounded-2xl bg-stone-950 px-4 text-white">تطبيق</button></div>{discountMsg?<p className="mt-2 text-xs text-stone-600">{discountMsg}</p>:null}</div>
      <div className="mt-4 rounded-3xl bg-stone-50 p-4 ring-1 ring-stone-200"><h3 className="font-black">بيانات العميل التجريبية لتابي</h3><div className="mt-3 grid gap-3"><input className="input" placeholder="الاسم" value={name} onChange={e=>setName(e.target.value)}/><input className="input" placeholder="الجوال" value={mobile} onChange={e=>setMobile(e.target.value)}/><input className="input" placeholder="الإيميل" value={email} onChange={e=>setEmail(e.target.value)}/></div></div>
      <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-stone-200"><Row label="المجموع" value={`${totals.subtotal.toFixed(2)} ريال`}/><Row label="الخصم" value={`-${totals.discountAmount.toFixed(2)} ريال`}/><Row label="الضريبة 15%" value={`${totals.vat.toFixed(2)} ريال`}/><Row label="الشحن" value="يحسب في الخطوة التالية"/><div className="mt-3 rounded-2xl bg-stone-950 p-3 text-center text-xl font-black text-white">{totals.total.toFixed(2)} ريال</div><div className="mt-3"><TabbyPromoWidget price={totals.total} source="cart"/></div></div>{msg?<p className="mt-4 rounded-2xl bg-amber-50 p-3 text-amber-900">{msg}</p>:null}
    </div><div className="border-t p-4"><button onClick={goShipping} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-lg font-black text-white"><ShoppingBag size={20}/> متابعة لبيانات الشحن</button></div></aside></div>:null}
  </main>;
}

function calcTotals(cart:CartItem[],discount:DiscountCode|null){const subtotal=roundMoney(cart.reduce((s,i)=>s+Number(i.product.price_before_vat||0)*i.quantity,0));const raw=discount?(discount.type==='percentage'?subtotal*(Number(discount.value||0)/100):Number(discount.value||0)):0;const cap=discount?.max_discount_amount?Math.min(raw,Number(discount.max_discount_amount)):raw;const discountAmount=roundMoney(Math.min(subtotal,Math.max(0,cap)));const taxable=roundMoney(subtotal-discountAmount);const vat=roundMoney(taxable*.15);const total=roundMoney(taxable+vat);return{subtotal,discountAmount,taxable,vat,total};}
function Row({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between py-1 text-sm"><span className="text-stone-500">{label}</span><b>{value}</b></div>}
