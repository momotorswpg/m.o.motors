const SUPABASE_URL="https://dpsgtliddmdvfwjahkkq.supabase.co";
const SUPABASE_KEY="sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const money=v=>Number.isFinite(Number(v))?new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(Number(v)):"$—";
const text=v=>String(v??"").trim();
let vehicles=[],images=new Map(),finance=MOMotorsFinance.normalize(),soldLimit=6;
const filterIds=["inventorySearch","makeFilter","modelFilter","priceFilter","yearMinFilter","yearMaxFilter","mileageFilter","bodyFilter","driveFilter","fuelFilter","stockFilter","sortInventory"];
const paramNames={inventorySearch:"q",makeFilter:"make",modelFilter:"model",priceFilter:"price",yearMinFilter:"yearMin",yearMaxFilter:"yearMax",mileageFilter:"mileage",bodyFilter:"body",driveFilter:"drive",fuelFilter:"fuel",stockFilter:"stock",sortInventory:"sort"};
const filterLabels={inventorySearch:"Search",makeFilter:"Make",modelFilter:"Model",priceFilter:"Price",yearMinFilter:"From",yearMaxFilter:"To",mileageFilter:"Mileage",bodyFilter:"Body",driveFilter:"Drive",fuelFilter:"Fuel",stockFilter:"Availability"};

const status=v=>text(v.Status??v.status??"Available").toLowerCase();
const isSold=v=>status(v)==="sold";
const isAvailable=v=>["available","in stock","active"].includes(status(v));
const numericSetting=(key,fallback)=>Number.isFinite(Number(finance[key]))?Number(finance[key]):fallback;
const unique=(field,predicate=()=>true)=>[...new Set(vehicles.filter(predicate).map(v=>text(v[field])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));

async function get(table,params={}){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${table}?${new URLSearchParams(params)}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
  if(!response.ok)throw new Error(await response.text());
  return response.json();
}

function optionList(id,values,label){$(id).innerHTML=`<option value="">${label}</option>`+values.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join("")}
function yearOptions(){
  const years=unique("Year").map(Number).filter(Number.isFinite).sort((a,b)=>b-a);
  ["yearMinFilter","yearMaxFilter"].forEach(id=>{$(id).innerHTML='<option value="">Any year</option>'+years.map(year=>`<option value="${year}">${year}</option>`).join("")});
}
function restoreFilters(){
  const params=new URLSearchParams(location.search);
  filterIds.forEach(id=>{const value=params.get(paramNames[id]);if(value===null)return;const control=$(id);if(id==="inventorySearch"||[...(control.options||[])].some(option=>option.value===value))control.value=value});
}
function updateUrl(){
  const params=new URLSearchParams();
  filterIds.forEach(id=>{const value=$(id).value.trim();const defaultValue=id==="stockFilter"?"available":id==="sortInventory"?"newest":"";if(value&&value!==defaultValue)params.set(paramNames[id],value)});
  history.replaceState(null,"",`${location.pathname}${params.size?`?${params}`:""}`);
}
function filterDefault(id){return id==="stockFilter"?"available":id==="sortInventory"?"newest":""}
function activeFilters(){
  return filterIds.filter(id=>id!=="sortInventory"&&$(id).value.trim()!==filterDefault(id)).map(id=>{
    const control=$(id),option=control.selectedOptions?.[0],value=option?.textContent||control.value;
    return {id,label:`${filterLabels[id]}: ${value}`};
  });
}
function renderFilterChips(){
  const filters=activeFilters(),count=$("activeFilterCount"),chips=$("activeFilterChips");
  count.textContent=filters.length;count.hidden=!filters.length;
  chips.innerHTML=filters.map(({id,label})=>`<button class="active-filter-chip" type="button" data-clear-filter="${id}" aria-label="Remove ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`).join("");
  chips.querySelectorAll("[data-clear-filter]").forEach(button=>button.addEventListener("click",()=>{$(button.dataset.clearFilter).value=filterDefault(button.dataset.clearFilter);soldLimit=6;render()}));
}
function setFilterPanel(open){
  document.body.classList.toggle("inventory-filters-open",open);$("openInventoryFilters").setAttribute("aria-expanded",String(open));
  if(open)$("closeInventoryFilters").focus();else $("openInventoryFilters").focus();
}
function matches(v){
  const query=$("inventorySearch").value.trim().toLowerCase(),make=$("makeFilter").value,model=$("modelFilter").value,body=$("bodyFilter").value,drive=$("driveFilter").value,fuel=$("fuelFilter").value;
  const price=Number(v.Price)||0,year=Number(v.Year)||0,mileage=Number(v.Mileage)||0,range=$("priceFilter").value,yearMin=Number($("yearMinFilter").value)||0,yearMax=Number($("yearMaxFilter").value)||Infinity,maxMileage=Number($("mileageFilter").value)||Infinity;
  const priceMatch=!range||(range==="under-10000"&&price<10000)||(range==="10000-15000"&&price>=10000&&price<15000)||(range==="15000-25000"&&price>=15000&&price<25000)||(range==="25000-plus"&&price>=25000);
  return (!query||`${v.Year} ${v.Make} ${v.Model} ${v.Trim||""}`.toLowerCase().includes(query))&&(!make||v.Make===make)&&(!model||v.Model===model)&&priceMatch&&year>=yearMin&&year<=yearMax&&mileage<=maxMileage&&(!body||v.BodyStyle===body)&&(!drive||v.Drivetrain===drive)&&(!fuel||v.FuelType===fuel);
}
function sortList(list){
  const sort=$("sortInventory").value;
  return [...list].sort((a,b)=>sort==="price-low"?Number(a.Price)-Number(b.Price):sort==="price-high"?Number(b.Price)-Number(a.Price):sort==="year-new"?Number(b.Year)-Number(a.Year):sort==="mileage-low"?Number(a.Mileage)-Number(b.Mileage):new Date(b.created_at||0)-new Date(a.created_at||0));
}
function card(v,soldVehicle=false){
  const title=`${v.Year||""} ${v.Make||""} ${v.Model||""}`.trim(),gallery=(images.get(String(v.id))||[]).map(photo=>photo.image_url),first=gallery[0],thumb=first?MOMotorsImages.thumbnail(first):"",payment=money(Math.round(MOMotorsFinance.calculate({price:v.Price,settings:finance}).payment));
  return `<article class="vehicle-card ${soldVehicle?"sold-card":""}"><div class="vehicle-image ${first?"":"placeholder"}" data-gallery='${esc(JSON.stringify(gallery))}' data-index="0">${first?`<a class="vehicle-image-link" href="vehicle.html?id=${encodeURIComponent(v.id)}"><img src="${esc(thumb)}" data-original-src="${esc(first)}" width="720" height="480" alt="${esc(title)}" loading="lazy" decoding="async"></a>`:'<span>PHOTO COMING SOON</span>'}${gallery.length>1?`<button class="card-gallery-arrow prev" type="button" aria-label="Previous photo">‹</button><button class="card-gallery-arrow next" type="button" aria-label="Next photo">›</button><span class="photo-counter">1 / ${gallery.length}</span>`:""}${soldVehicle?'<div class="sold-badge">SOLD</div>':""}</div><div class="vehicle-info"><p class="vehicle-year">${soldVehicle?"SOLD":"PRE-OWNED"}</p><h3><a class="vehicle-title-link" href="vehicle.html?id=${encodeURIComponent(v.id)}">${esc(title)}</a></h3><div class="vehicle-meta"><span>${Number(v.Mileage||0).toLocaleString("en-CA")} km</span><span>${esc(v.Transmission||"Automatic")}</span></div><div class="price-row"><div class="price-finance"><strong>${money(v.Price)}</strong>${soldVehicle?"":`<span class="inline-payment">or <b>${payment}</b> ${MOMotorsFinance.frequency(finance.payment_frequency).label}</span>`}</div>${soldVehicle?'<span class="sold-label">Sold</span>':`<a href="vehicle.html?id=${encodeURIComponent(v.id)}">View Details →</a>`}</div>${soldVehicle?"":`<div class="finance-payment"><small>Price incl. GST/PST and financing fee. Financing based on ${numericSetting("term_months",48)} mo. with ${money(numericSetting("down_payment",0))} down, no trade-in. OAC.</small></div>`}</div></article>`;
}
function bindGalleries(root){
  MOMotorsImages.bindFallbacks(root);
  root.querySelectorAll(".vehicle-image[data-gallery]").forEach(box=>{
    const gallery=JSON.parse(box.dataset.gallery||"[]");let index=0;const image=box.querySelector("img"),counter=box.querySelector(".photo-counter");
    const change=direction=>{if(!gallery.length||!image)return;index=(index+direction+gallery.length)%gallery.length;const original=gallery[index];image.src=MOMotorsImages.thumbnail(original);image.dataset.originalSrc=original;box.dataset.index=index;if(counter)counter.textContent=`${index+1} / ${gallery.length}`};
    box.querySelector(".prev")?.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();change(-1)});box.querySelector(".next")?.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();change(1)});
  });
}
function render(){
  updateUrl();
  const matching=sortList(vehicles.filter(matches)),available=matching.filter(isAvailable),sold=matching.filter(isSold),showSold=$("stockFilter").value==="all";
  $("inventoryCount").textContent=`${available.length} available vehicle${available.length===1?"":"s"}`;
  $("inventoryGrid").innerHTML=available.length?available.map(v=>card(v)).join(""):'<div class="inventory-empty">No available vehicles match these filters. Try clearing one or more filters.</div>';
  const visibleSold=sold.slice(0,soldLimit);$("soldCount").textContent=`${sold.length} recently sold vehicle${sold.length===1?"":"s"}`;$("soldInventoryGrid").innerHTML=visibleSold.length?visibleSold.map(v=>card(v,true)).join(""):'<div class="inventory-empty">No sold vehicles match these filters.</div>';
  $("loadMoreSold").hidden=visibleSold.length>=sold.length;$("recentlySoldSection").open=showSold||$("recentlySoldSection").open;
  renderFilterChips();
  bindGalleries($("inventoryGrid"));bindGalleries($("soldInventoryGrid"));
}
async function load(){
  try{
    [finance,vehicles]=await Promise.all([MOMotorsFinance.load(),get("Vehicles",{select:"*",order:"created_at.desc"})]);vehicles=vehicles.filter(v=>isAvailable(v)||isSold(v));
    const photos=await get("vehicle_images",{select:"*",order:"is_primary.desc,sort_order.asc"});photos.forEach(photo=>{const key=String(photo.vehicle_id);if(!images.has(key))images.set(key,[]);images.get(key).push(photo)});
    optionList("makeFilter",unique("Make"),"All makes");optionList("modelFilter",unique("Model"),"All models");optionList("bodyFilter",unique("BodyStyle",isAvailable),"All body styles");optionList("driveFilter",unique("Drivetrain",isAvailable),"All drivetrains");optionList("fuelFilter",unique("FuelType",isAvailable),"All fuel types");yearOptions();restoreFilters();
    filterIds.forEach(id=>$(id).addEventListener(id==="inventorySearch"?"input":"change",()=>{soldLimit=6;render()}));
    $("clearInventoryFilters").addEventListener("click",()=>{filterIds.forEach(id=>$(id).value=id==="stockFilter"?"available":id==="sortInventory"?"newest":"");soldLimit=6;$("recentlySoldSection").open=false;render()});
    $("openInventoryFilters").addEventListener("click",()=>setFilterPanel(true));
    $("closeInventoryFilters").addEventListener("click",()=>setFilterPanel(false));
    $("inventoryFilterBackdrop").addEventListener("click",()=>setFilterPanel(false));
    $("applyInventoryFilters").addEventListener("click",()=>setFilterPanel(false));
    addEventListener("keydown",event=>{if(event.key==="Escape"&&document.body.classList.contains("inventory-filters-open"))setFilterPanel(false)});
    $("loadMoreSold").addEventListener("click",()=>{soldLimit+=6;render()});
    $("recentlySoldSection").addEventListener("toggle",()=>{$("recentlySoldSection").querySelector(".sold-toggle").textContent=$("recentlySoldSection").open?"Hide":"Show"});render();
  }catch(error){console.error(error);$("inventoryGrid").innerHTML='<div class="inventory-empty">Inventory is temporarily unavailable. Please try again shortly.</div>'}
}
load();
