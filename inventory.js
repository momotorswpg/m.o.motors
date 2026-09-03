const SUPABASE_URL="https://dpsgtliddmdvfwjahkkq.supabase.co";
const SUPABASE_KEY="sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const money=v=>Number.isFinite(Number(v))?new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(Number(v)):"$—";
let vehicles=[],images=new Map();
let finance={apr:8.99,term_months:84,down_payment:0,financing_fee:1000,payment_frequency:"biweekly"};

const status=v=>String(v.Status??v.status??"Available").trim().toLowerCase();
const isSold=v=>status(v)==="sold";
const isAvailable=v=>["available","in stock","active"].includes(status(v));
const statusRank=v=>isAvailable(v)?0:status(v)==="pending"?1:status(v)==="hold"?2:isSold(v)?3:4;
const frequencyInfo=()=>finance.payment_frequency==="weekly"?{periods:52,label:"weekly"}:finance.payment_frequency==="monthly"?{periods:12,label:"monthly"}:{periods:26,label:"bi-weekly"};
const numericSetting=(key,fallback)=>Number.isFinite(Number(finance[key]))?Number(finance[key]):fallback;

async function get(table,params={}){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${table}?${new URLSearchParams(params)}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
  if(!response.ok)throw new Error(await response.text());
  return response.json();
}

function estimatedPayment(price){
  const {periods}=frequencyInfo();
  const months=numericSetting("term_months",84);
  const principal=Math.max(0,Number(price||0)*1.12+numericSetting("financing_fee",1000)-numericSetting("down_payment",0));
  const rate=numericSetting("apr",8.99)/100/periods;
  const payments=months/12*periods;
  if(!principal||!payments)return 0;
  return rate?principal*rate/(1-Math.pow(1+rate,-payments)):principal/payments;
}

async function load(){
  try{
    const settings=await get("finance_settings",{select:"*",id:"eq.1"}).catch(()=>[]);
    if(settings[0])finance={...finance,...settings[0]};
    vehicles=(await get("Vehicles",{select:"*",order:"created_at.desc"})).filter(v=>isAvailable(v)||isSold(v));
    const photos=await get("vehicle_images",{select:"*",order:"is_primary.desc,sort_order.asc"});
    photos.forEach(photo=>{const key=String(photo.vehicle_id);if(!images.has(key))images.set(key,[]);images.get(key).push(photo)});
    const makes=[...new Set(vehicles.map(v=>v.Make).filter(Boolean))].sort();
    $("makeFilter").innerHTML='<option value="">All Makes</option>'+makes.map(make=>`<option>${esc(make)}</option>`).join("");
    ["inventorySearch","makeFilter","sortInventory"].forEach(id=>$(id).addEventListener(id==="inventorySearch"?"input":"change",render));
    render();
  }catch(error){
    console.error(error);
    $("inventoryGrid").innerHTML='<div class="inventory-empty">Inventory is temporarily unavailable. Please try again shortly.</div>';
  }
}

function render(){
  const query=$("inventorySearch").value.trim().toLowerCase(),make=$("makeFilter").value,sort=$("sortInventory").value;
  let list=vehicles.filter(v=>`${v.Year} ${v.Make} ${v.Model}`.toLowerCase().includes(query)&&(!make||v.Make===make));
  list.sort((a,b)=>{const difference=statusRank(a)-statusRank(b);if(difference)return difference;if(sort==="price-low")return Number(a.Price)-Number(b.Price);if(sort==="price-high")return Number(b.Price)-Number(a.Price);if(sort==="year-new")return Number(b.Year)-Number(a.Year);return new Date(b.created_at||0)-new Date(a.created_at||0)});
  const available=list.filter(isAvailable).length,sold=list.filter(isSold).length;
  $("inventoryCount").textContent=`${available} available${sold?` · ${sold} sold`:""}`;
  const frequency=frequencyInfo().label,term=numericSetting("term_months",84),down=numericSetting("down_payment",0);
  $("inventoryGrid").innerHTML=list.length?list.map(v=>{
    const title=`${v.Year||""} ${v.Make||""} ${v.Model||""}`.trim(),gallery=images.get(String(v.id))||[],soldVehicle=isSold(v),payment=money(Math.round(estimatedPayment(v.Price))),first=gallery[0];
    return `<article class="vehicle-card ${soldVehicle?"sold-card":""}"><div class="vehicle-image ${first?"":"placeholder"}" data-gallery='${esc(JSON.stringify(gallery.map(p=>p.image_url)))}' data-index="0">${first?`<a class="vehicle-image-link" href="vehicle.html?id=${encodeURIComponent(v.id)}"><img src="${esc(first.image_url)}" alt="${esc(title)}" loading="lazy"></a>`:'<span>PHOTO COMING SOON</span>'}${gallery.length>1?`<button class="card-gallery-arrow prev" type="button" aria-label="Previous photo">‹</button><button class="card-gallery-arrow next" type="button" aria-label="Next photo">›</button><span class="photo-counter">1 / ${gallery.length}</span>`:""}${soldVehicle?'<div class="sold-badge">SOLD</div>':""}</div><div class="vehicle-info"><p class="vehicle-year">${soldVehicle?"SOLD":"PRE-OWNED"}</p><h3><a class="vehicle-title-link" href="vehicle.html?id=${encodeURIComponent(v.id)}">${esc(title)}</a></h3><div class="vehicle-meta"><span>${Number(v.Mileage).toLocaleString("en-CA")} km</span><span>${esc(v.Transmission||"Automatic")}</span></div><div class="price-row"><div class="price-finance"><strong>${money(v.Price)}</strong>${soldVehicle?"":`<span class="inline-payment">or <b>${payment}</b> ${frequency}</span>`}</div>${soldVehicle?'<span class="sold-label">Sold</span>':`<a href="vehicle.html?id=${encodeURIComponent(v.id)}">View Details →</a>`}</div>${soldVehicle?"":`<div class="finance-payment"><small>Price incl. GST/PST and financing fee. Financing based on ${term} mo. with ${money(down)} down, no trade-in. OAC.</small></div>`}</div></article>`;
  }).join(""):'<div class="inventory-empty">No vehicles match your search.</div>';
  document.querySelectorAll(".vehicle-image[data-gallery]").forEach(box=>{
    const gallery=JSON.parse(box.dataset.gallery||"[]");let index=0;const image=box.querySelector("img"),counter=box.querySelector(".photo-counter");
    const change=direction=>{if(!gallery.length)return;index=(index+direction+gallery.length)%gallery.length;image.src=gallery[index];box.dataset.index=index;if(counter)counter.textContent=`${index+1} / ${gallery.length}`};
    box.querySelector(".prev")?.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();change(-1)});
    box.querySelector(".next")?.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();change(1)});
  });
}

load();
