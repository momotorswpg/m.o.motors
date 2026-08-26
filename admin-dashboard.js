(()=>{
const $=id=>document.getElementById(id);
function init(){
  const admin=$('adminView'); if(!admin||admin.dataset.pagesReady)return;
  admin.dataset.pagesReady='1';
  const top=admin.querySelector('.topbar');
  const stats=admin.querySelector('.stats-row');
  const finance=admin.querySelector('.finance-panel');
  const bookings=admin.querySelector('.bookings-panel');
  const tradeins=admin.querySelector('.tradeins-panel');
  const grid=admin.querySelector('.layout-grid');
  const inventory=admin.querySelector('.inventory-panel');
  const nav=document.createElement('nav'); nav.className='admin-page-nav';
  ['Dashboard','Inventory','Bookings','Finance','Settings'].forEach(name=>{const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.page=name.toLowerCase();nav.appendChild(b)});
  top.after(nav);
  const dash=document.createElement('section'); dash.className='admin-page';dash.dataset.page='dashboard';
  dash.innerHTML='<div class="dashboard-hero"><span class="eyebrow">DASHBOARD</span><h3>Dealership overview</h3><p class="muted">Your inventory and latest customer activity at a glance.</p></div><div class="dashboard-stats"><div class="stat-card"><span>Available for sale</span><strong id="dashAvailable">0</strong></div><div class="stat-card"><span>Sold vehicles</span><strong id="dashSold">0</strong></div><div class="stat-card"><span>Total inventory</span><strong id="dashTotal">0</strong></div><div class="stat-card"><span>New bookings</span><strong id="dashNewBookings">0</strong></div></div><section class="panel dashboard-bookings"><div class="panel-head"><div><span class="eyebrow">LATEST BOOKINGS</span><h3>Recent test drive requests</h3></div></div><div id="dashRecentBookings" class="bookings-list"><div class="muted">Loading bookings…</div></div></section>';
  nav.after(dash);
  const wrap=(el,page)=>{if(!el)return;const s=document.createElement('section');s.className='admin-page';s.dataset.page=page;el.before(s);s.appendChild(el)};
  wrap(grid,'inventory');wrap(inventory,'inventory');wrap(bookings,'bookings');wrap(tradeins,'bookings');wrap(finance,'finance');
  if(stats)stats.style.display='none';
  let current=''; let bookingsLoaded=false; let dashboardLoaded=false;
  function show(page){
    if(page==='settings')page='finance';
    if(!['dashboard','inventory','bookings','finance'].includes(page))page='dashboard';
    if(page===current)return;
    current=page;
    admin.querySelectorAll('.admin-page').forEach(section=>section.hidden=section.dataset.page!==page);
    nav.querySelectorAll('button').forEach(button=>button.classList.toggle('active',(button.dataset.page==='settings'?'finance':button.dataset.page)===page));
    if(page==='bookings'&&!bookingsLoaded){bookingsLoaded=true;window.loadBookings?.();}
    if(page==='dashboard'&&!dashboardLoaded){dashboardLoaded=true;loadDashboard();}
  }
  nav.addEventListener('click',event=>{const button=event.target.closest('button[data-page]');if(button)show(button.dataset.page)});
  show('dashboard');
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
async function loadDashboard(){
  const a=$('dashAvailable');if(!a||typeof db==='undefined')return;
  try{
    const {data:vs,error:ve}=await db.from('Vehicles').select('id,Status');if(ve)throw ve;
    const rows=vs||[];a.textContent=rows.filter(v=>String(v.Status||'Available').toLowerCase()==='available').length;
    $('dashSold').textContent=rows.filter(v=>String(v.Status||'').toLowerCase()==='sold').length;$('dashTotal').textContent=rows.length;
    const {data:bs,error:be}=await db.from('test_drive_bookings').select('*,Vehicles(Year,Make,Model)').order('created_at',{ascending:false});if(be)throw be;
    const bookings=bs||[];$('dashNewBookings').textContent=bookings.filter(b=>String(b.status||'New')==='New').length;
    const list=$('dashRecentBookings');list.innerHTML=bookings.slice(0,5).map(b=>{const v=b.Vehicles?`${b.Vehicles.Year||''} ${b.Vehicles.Make||''} ${b.Vehicles.Model||''}`.trim():(b.vehicle_name||'Vehicle not specified');return `<article class="booking-card"><div class="booking-main"><h4>${esc(b.first_name)} ${esc(b.last_name)}</h4><div class="booking-details"><div><span>Vehicle</span><strong>${esc(v)}</strong></div><div><span>Requested appointment</span><strong>${esc(b.preferred_date)} · ${esc(b.preferred_time)}</strong></div></div></div></article>`}).join('')||'<div class="booking-empty">No test drive bookings yet.</div>';
  }catch(error){console.error(error);const list=$('dashRecentBookings');if(list)list.innerHTML='<div class="booking-empty">Could not load dashboard data.</div>';}
}
document.addEventListener('DOMContentLoaded',init);
})();