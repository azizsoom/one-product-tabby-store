'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { db } from '../../lib/db';
import TabbyPromoWidget from './TabbyPromoWidget';
import { CHECKOUT_DRAFT_KEY, roundMoney } from '../checkout/constants';

type Product = { id:string; name:string; description:string|null; price_before_vat:number; shipping_amount:number; stock_quantity:number; image_url:string|null; created_at?:string };
type CartItem = { product: Product; quantity: number };
type DiscountCode = { code:string; type:'percentage'|'fixed'; value:number; max_discount_amount:number|null; is_active:boolean; usage_limit:number|null; used_count:number };

export default function StorefrontCheckoutLite() {
  const router = useRouter();
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

  useEffect(()=>{ db.from('products').select('*').eq('is_active',true).order('created_at',{ascending:false}).then(({data})=>setProducts((data||[]) as Product[])); },[]);
  useEffect(()=>{ document.body.style.overflow=open?'hidden':''; return()=>{document.body.style.overflow=''};},[open]);

  const visible=useMemo(()=>{ const q=search.trim().toLowerCase(); return products.filter(p=>!q||String(p.name).toLowerCase().includes(q)||String(p.description||'').toLowerCase().includes(q)).sort((a,b)=> sortBy==='price_low'?Number(a.price_before_vat)-Number(b.price_before_vat):sortBy==='price_high'?Number(b.price_before_vat)-Number(a.price_before_vat):Number(b.stock_quantity||0)-Number(a.stock_quantity||0));},[products,search,sortBy]);
  const totals=useMemo(()=>calcTotals(cart,discount),[cart,discount]);
  const qty=cart.reduce((s,i)=>s+i.quantity,0);

  function add(p:Product){ setMsg(''); const stock=Number(p.stock_quantity||0); if(stock<=0)return setMsg('هذا المنتج غير متوفر.'); setCart(items=>{ const old=items.find(i=>i.product.id===p.id); if(old){ if(old.quantity>=stock){setMsg('الكمية المطلوبة أكبر من المتوفر.'); return items;} return items.map(i=>i.product.id===p.id?{...i,quantity:i.quantity+1}:i);} return [...items,{product:p,quantity:1}];}); setMsg('تمت إضافة المنتج للسلة. اضغط زر السلة لإكمال الطلب.'); }
  function changeQty(id:string,n:number){ setCart(items=>items.map(i=>i.product.id===id?{...i,quantity:Math.max(1,Math.min(Number(i.product.stock_quantity||1),Math.floor(n||1)))}:i)); }
  function remove(id:string){ setCart(items=>items.filter(i=>i.product.id!==id)); }

  async function applyDiscount(){ const code=discountCode.trim().toUpperCase(); setDiscount(null); setDiscountMsg(''); if(!code)return setDiscountMsg('اكتب كود الخصم أولاً.'); if(cart.length===0)return setDiscountMsg('أضف منتجات للسلة.'); const {data,error}=await db.from('discount_codes').select('*').eq('code',code).single(); const row=data as DiscountCode|null; if(error||!row||!row.is_active)return setDiscountMsg('كود الخصم غير صحيح أو غير فعال.'); if(row.usage_limit!==null&&Number(row.used_count||0)>=Number(row.usage_limit))return setDiscountMsg('كود الخصم تجاوز حد الاستخدام.'); setDiscount(row); setDiscountCode(row.code); setDiscountMsg('تم تطبيق كود الخصم.'); }

  function goShipping(){ setMsg(''); if(cart.length===0)return setMsg('السلة فارغة.'); if(!name.trim()||!mobile.trim()||!email.trim())return setMsg('أدخل الاسم والجوال والإيميل قبل المتابعة.'); if(!/^\S+@\S+\.\S+$/.test(email))return setMsg('صيغة الإيميل غير صحيحة.'); localStorage.setItem(CHECKOUT_DRAFT_KEY,JSON.stringify({items:cart,customerName:name.trim(),customerMobile:mobile.trim(),customerEmail:email.trim(),discountCode:discount?.code||'',appliedDiscount:discount,savedAt:new Date().toISOString()})); router.push('/checkout/shipping'); }

  return <main dir="rtl" className="min-h-screen bg-stone-50 text-stone-950">
    <header className="sticky top-0 z-30 border-b bg-white/95"><div className="mx-auto flex max-w-7xl items-center justify-between p-4"><h1 className="text-xl font-black">المتجر الإلكتروني</h1><button onClick={()=>setOpen(true)} className="rounded-2xl bg-stone-950 px-5 py-3 font-bold text-white">السلة ({qty})</button></div></header>
    <section className="mx-auto max-w-7xl p-4">
      <div className="mb-5 rounded-[2rem] bg-stone-950 p-6 text-white"><h2 className="text-3xl font-black">اختر منتجاتك</h2><p className="mt-2 text-stone-200">بعد السلة تنتقل لصفحة العنوان الوطني وخيارات الشحن.</p></div>
      <div className="mb-4 grid gap-3 rounded-3xl bg-white p-4 ring-1 ring-stone-200 md:grid-cols-[1fr_220px]"><input className="input" placeholder="بحث عن منتج" value={search} onChange={e=>setSearch(e.target.value)}/><select className="input" value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="newest">الأحدث</option><option value="price_low">الأقل سعر</option><option value="price_high">الأعلى سعر</option><option value="stock">الأكثر توفر</option></select></div>
      {msg&&!open?<p className="mb-4 rounded-2xl bg-emerald-50 p-3 text-emerald-900 ring-1 ring-emerald-200">{msg}</p>:null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">{visible.map(p=><div key={p.id} className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-stone-200"><div className="aspect-square overflow-hidden rounded-2xl bg-stone-100">{p.image_url?<img src={p.image_url} alt={p.name} className="h-full w-full object-cover"/>:null}</div><h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-black">{p.name}</h3><p className="mt-2 text-center text-2xl font-black">{Number(p.price_before_vat||0).toFixed(0)} <span className="text-xs">ريال</span></p><button onClick={()=>add(p)} disabled={Number(p.stock_quantity||0)<=0} className="mt-3 w-full rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white disabled:bg-stone-300">إضافة للسلة</button></div>)}</div>
    </section>
    {open?<div className="fixed inset-0 z-50"><button className="absolute inset-0 bg-black/40" onClick={()=>setOpen(false)}/><aside className="absolute left-0 top-0 flex h-full w-full max-w-md flex-col bg-white"><div className="border-b p-4"><h2 className="text-2xl font-black">سلة المشتريات</h2></div><div className="flex-1 overflow-auto p-4">
      {cart.length===0?<p className="rounded-3xl bg-stone-50 p-6 text-center">السلة فارغة</p>:<div className="space-y-3">{cart.map(i=><div key={i.product.id} className="rounded-3xl border p-3"><div className="flex gap-3"><div className="h-16 w-16 overflow-hidden rounded-2xl bg-stone-100">{i.product.image_url?<img src={i.product.image_url} className="h-full w-full object-cover" alt=""/>:null}</div><div className="flex-1"><h3 className="font-black">{i.product.name}</h3><p className="text-sm text-stone-500">{Number(i.product.price_before_vat).toFixed(2)} ريال</p></div><button onClick={()=>remove(i.product.id)} className="text-red-600"><Trash2 size={18}/></button></div><div className="mt-3 flex items-center gap-2"><button onClick={()=>changeQty(i.product.id,i.quantity-1)} className="h-9 w-9 rounded-xl bg-stone-100">-</button><input className="input max-w-20 text-center" type="number" value={i.quantity} onChange={e=>changeQty(i.product.id,Number(e.target.value))}/><button onClick={()=>changeQty(i.product.id,i.quantity+1)} className="h-9 w-9 rounded-xl bg-stone-100">+</button></div></div>)}</div>}
      <div className="mt-4 rounded-3xl bg-stone-50 p-4 ring-1 ring-stone-200"><h3 className="font-black">كود الخصم</h3><div className="mt-2 flex gap-2"><input className="input" value={discountCode} onChange={e=>setDiscountCode(e.target.value)} placeholder="SAVE10"/><button onClick={applyDiscount} className="rounded-2xl bg-stone-950 px-4 text-white">تطبيق</button></div>{discountMsg?<p className="mt-2 text-xs text-stone-600">{discountMsg}</p>:null}</div>
      <div className="mt-4 rounded-3xl bg-stone-50 p-4 ring-1 ring-stone-200"><h3 className="font-black">بيانات العميل التجريبية لتابي</h3><div className="mt-3 grid gap-3"><input className="input" placeholder="الاسم" value={name} onChange={e=>setName(e.target.value)}/><input className="input" placeholder="الجوال" value={mobile} onChange={e=>setMobile(e.target.value)}/><input className="input" placeholder="الإيميل" value={email} onChange={e=>setEmail(e.target.value)}/></div></div>
      <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-stone-200"><Row label="المجموع" value={`${totals.subtotal.toFixed(2)} ريال`}/><Row label="الخصم" value={`-${totals.discountAmount.toFixed(2)} ريال`}/><Row label="الضريبة 15%" value={`${totals.vat.toFixed(2)} ريال`}/><Row label="الشحن" value="يحسب في الخطوة التالية"/><div className="mt-3 rounded-2xl bg-stone-950 p-3 text-center text-xl font-black text-white">{totals.total.toFixed(2)} ريال</div><div className="mt-3"><TabbyPromoWidget price={totals.total} source="cart"/></div></div>{msg?<p className="mt-4 rounded-2xl bg-amber-50 p-3 text-amber-900">{msg}</p>:null}
    </div><div className="border-t p-4"><button onClick={goShipping} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-lg font-black text-white"><ShoppingBag size={20}/> متابعة لبيانات الشحن</button></div></aside></div>:null}
  </main>;
}

function calcTotals(cart:CartItem[],discount:DiscountCode|null){const subtotal=roundMoney(cart.reduce((s,i)=>s+Number(i.product.price_before_vat||0)*i.quantity,0));const raw=discount?(discount.type==='percentage'?subtotal*(Number(discount.value||0)/100):Number(discount.value||0)):0;const cap=discount?.max_discount_amount?Math.min(raw,Number(discount.max_discount_amount)):raw;const discountAmount=roundMoney(Math.min(subtotal,Math.max(0,cap)));const taxable=roundMoney(subtotal-discountAmount);const vat=roundMoney(taxable*.15);const total=roundMoney(taxable+vat);return{subtotal,discountAmount,taxable,vat,total};}
function Row({label,value}:{label:string;value:string}){return <div className="flex items-center justify-between py-1 text-sm"><span className="text-stone-500">{label}</span><b>{value}</b></div>}
