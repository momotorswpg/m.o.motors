(()=>{
  "use strict";
  const db=supabase.createClient("https://dpsgtliddmdvfwjahkkq.supabase.co","sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0");
  const $=id=>document.getElementById(id);
  const state={user:null,member:null,vehicles:[],ready:new Set(),space:null,tab:null,poll:null,follow:null,replyTo:null,alerts:[]};
  const channels={owner_vehicle:"Owner prep",sales_vehicle:"Sales discussion",owner_group:"Owners",sales_group:"Sales team"};
  const money=n=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"}).format(Number(n)||0);
  const clean=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
  const date=s=>new Date(s).toLocaleString("en-CA",{dateStyle:"medium",timeStyle:"short"});
  function toast(message){const node=$("staffToast");node.textContent=message;node.classList.add("show");clearTimeout(node._timer);node._timer=setTimeout(()=>node.classList.remove("show"),5000)}
  function showLogin(message=""){$("staffLogin").hidden=false;$("staffApp").hidden=true;$("staffSignOut").hidden=true;$("staffAlerts").hidden=true;$("staffLoginStatus").textContent=message;state.member=null;clearInterval(state.poll)}
  function vehicleName(v){return [v.Year,v.Make,v.Model,v.Trim].filter(Boolean).join(" ")||`Vehicle #${v.id}`}
  function isOwner(){return state.member?.role==="owner"}
  async function query(promise){const {data,error}=await promise;if(error)throw error;return data}
  async function load(){
    const {data:{user},error:authError}=await db.auth.getUser();
    if(authError||!user){showLogin();return}
    const member=await query(db.from("staff_members").select("user_id,display_name,role").eq("user_id",user.id).maybeSingle());
    if(!member){showLogin("This account has no staff access. Ask an owner to add it.");return}
    state.user=user;state.member=member;
    $("staffName").textContent=`${member.display_name} · ${member.role}`;
    $("staffLogin").hidden=true;$("staffApp").hidden=false;$("staffSignOut").hidden=false;$("staffAlerts").hidden=false;
    $("staffReadyAlertsLabel").hidden=isOwner();
    await refresh();
    await refreshAlerts();
    const params=new URLSearchParams(location.search);
    const requestedVehicle=Number(params.get('vehicle'));
    const requestedChannel=params.get('channel');
    if(requestedVehicle&&state.vehicles.some(v=>Number(v.id)===requestedVehicle))select({vehicleId:requestedVehicle});
    else if(requestedChannel&&channels[requestedChannel]&&(isOwner()||requestedChannel==='sales_group'))select({channel:requestedChannel,vehicleId:null});
    clearInterval(state.poll);state.poll=setInterval(()=>{
      refreshAlerts().catch(error=>toast(error.message));
      if(!state.space)return;
      const draft=[...$("staffPane").querySelectorAll('textarea')].some(input=>input.value.trim());
      if(draft)return;
      renderPane().catch(error=>toast(error.message));
    },15000);
  }
  async function refresh(){
    const [vehicles,ready]=await Promise.all([
      query(db.from("Vehicles").select("id,Year,Make,Model,Trim,VIN,Status,Price").order("created_at",{ascending:false})),
      query(db.from("staff_vehicle_state").select("vehicle_id,ready_for_sale").eq("ready_for_sale",true))
    ]);
    state.ready=new Set(ready.map(row=>Number(row.vehicle_id)));
    state.vehicles=isOwner()?vehicles:vehicles.filter(v=>state.ready.has(Number(v.id)));
    renderSidebar();
    if(state.space?.vehicleId&&!state.vehicles.some(v=>Number(v.id)===state.space.vehicleId)){state.space=null;$("staffDetail").hidden=true;$("staffEmpty").hidden=false}
    else if(state.space)renderDetail();
  }
  function renderSidebar(){
    $("staffGroups").innerHTML=(isOwner()?['owner_group','sales_group']:['sales_group']).map(channel=>
      `<button class="staff-nav-item ${state.space?.channel===channel?'active':''}" data-channel="${channel}">${channels[channel]} chat</button>`).join("");
    const filter=$("staffSearch").value.trim().toLowerCase();
    $("staffVehicles").innerHTML=state.vehicles.filter(v=>`${vehicleName(v)} ${v.VIN||''}`.toLowerCase().includes(filter)).map(v=>
      `<button class="staff-nav-item ${state.space?.vehicleId===Number(v.id)?'active':''}" data-vehicle="${v.id}">${clean(vehicleName(v))}<small>${state.ready.has(Number(v.id))?'Ready for sale':'In preparation'} · ${clean(v.Status||'')}</small></button>`).join("")||'<p>No vehicles found.</p>';
  }
  function select(space){state.space=space;state.tab=space.vehicleId?(isOwner()?'owner_vehicle':'sales_vehicle'):space.channel;state.replyTo=null;renderSidebar();renderDetail()}
  function renderDetail(){
    if(!state.space)return;
    const v=state.vehicles.find(item=>Number(item.id)===state.space.vehicleId);
    $("staffEmpty").hidden=true;$("staffDetail").hidden=false;
    $("staffDetailEyebrow").textContent=v?'VEHICLE WORKSPACE':'TEAM CHAT';
    $("staffDetailTitle").textContent=v?vehicleName(v):channels[state.space.channel];
    $("staffDetailSub").textContent=v?`${v.VIN||'VIN not entered'} · ${money(v.Price)} listing · ${v.Status||'Status not set'} · ${state.ready.has(Number(v.id))?'Sales team has access':'Owner preparation only'}`:'Private team conversation';
    $("staffReady").hidden=!v||!isOwner()||state.ready.has(Number(v.id));
    const tabs=v?(isOwner()?['owner_vehicle','expenses','sales_vehicle','activity']:['sales_vehicle','activity']):[state.space.channel];
    if(!tabs.includes(state.tab))state.tab=tabs[0];
    $("staffTabs").innerHTML=tabs.map(tab=>`<button type="button" role="tab" data-tab="${tab}" aria-selected="${tab===state.tab}" class="${tab===state.tab?'active':''}">${clean(channels[tab]||({expenses:'Expenses',activity:'Sales activity'}[tab]))}</button>`).join("");
    loadFollow().catch(error=>toast(error.message));
    renderPane().catch(error=>toast(error.message));
  }
  function followChannel(){return channels[state.tab]?state.tab:(state.tab==='expenses'?'owner_vehicle':'sales_vehicle')}
  async function loadFollow(){
    const channel=followChannel(),vehicleId=state.space?.vehicleId||null;
    if(!channel)return;
    let request=db.from('staff_follows').select('id,following,muted').eq('user_id',state.user.id).eq('channel',channel);
    request=vehicleId?request.eq('vehicle_id',vehicleId):request.is('vehicle_id',null);
    const record=await query(request.maybeSingle());
    if(channel!==followChannel()||vehicleId!==(state.space?.vehicleId||null))return;
    state.follow=record;
    $('staffFollow').textContent=record?.following?'Following':'Follow';
    $('staffFollow').classList.toggle('active',Boolean(record?.following));
    $('staffMute').textContent=record?.muted?'Unmute':'Mute';
    $('staffMute').classList.toggle('active',Boolean(record?.muted));
  }
  async function saveFollow(change){
    const current=state.follow;
    if(current)await query(db.from('staff_follows').update(change).eq('id',current.id));
    else await query(db.from('staff_follows').insert({user_id:state.user.id,channel:followChannel(),vehicle_id:state.space?.vehicleId||null,following:false,muted:false,...change}));
    await loadFollow();
  }
  async function renderPane(){
    const space=state.space,tab=state.tab;if(!space)return;
    if(tab==='expenses'){await renderExpenses(space.vehicleId);return}
    if(tab==='activity'){await renderActivity(space.vehicleId);return}
    await renderMessages(tab,space.vehicleId||null);
  }
  async function renderMessages(channel,vehicleId){
    let request=db.from("staff_messages").select("id,author_id,author_name,body,reply_to,created_at").eq("channel",channel).order("created_at",{ascending:false}).limit(200);
    request=vehicleId?request.eq("vehicle_id",vehicleId):request.is("vehicle_id",null);
    const rows=(await query(request)).reverse();
    if(state.tab!==channel||state.space?.vehicleId!==vehicleId)return;
    const attachments=rows.length?await query(db.from("staff_attachments").select("message_id,object_path").in("message_id",rows.map(r=>r.id))):[];
    const files=new Map();for(const a of attachments){if(!files.has(a.message_id))files.set(a.message_id,[]);files.get(a.message_id).push(a.object_path)}
    $("staffPane").innerHTML=`<div class="staff-list">${rows.length?rows.map(row=>`<article class="staff-entry"><strong>${clean(row.author_name)}</strong><time>${date(row.created_at)}</time>${row.reply_to?'<em>↪ Reply</em>':''}<p>${clean(row.body)}</p><div class="staff-photos" data-message="${row.id}"></div><button type="button" data-reply="${row.id}">Reply</button></article>`).join(''):'<p>No messages yet.</p>'}</div><form class="staff-composer" id="staffMessageForm"><label for="staffMessage">Message (mention a teammate with @handle)</label><p id="staffReplyBanner" class="staff-reply-banner" ${state.replyTo?'':'hidden'}>Replying to a message <button id="staffCancelReply" type="button">Cancel</button></p><textarea id="staffMessage" maxlength="4000" required placeholder="Share an update with this team…"></textarea><div class="staff-composer-actions"><label>Photo <input id="staffPhoto" type="file" accept="image/*"></label><button type="submit">Send</button></div></form>`;
    for(const [messageId,paths] of files){const box=$("staffPane").querySelector(`[data-message="${messageId}"]`);for(const path of paths){const {data,error}=await db.storage.from('staff-private').createSignedUrl(path,300);if(error)continue;const img=document.createElement('img');img.src=data.signedUrl;img.alt='Attached vehicle photo';box.append(img)}}
    $("staffMessageForm").addEventListener('submit',event=>sendMessage(event,channel,vehicleId));
    $("staffPane").querySelectorAll('[data-reply]').forEach(button=>button.addEventListener('click',()=>{state.replyTo=button.dataset.reply;$("staffReplyBanner").hidden=false;$("staffMessage").focus()}));
    $("staffCancelReply").addEventListener('click',()=>{state.replyTo=null;$("staffReplyBanner").hidden=true});
    const list=$("staffPane").querySelector('.staff-list');list.scrollTop=list.scrollHeight;
  }
  async function sendMessage(event,channel,vehicleId){
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button[type="submit"]');button.disabled=true;
    try{
      const body=$("staffMessage").value.trim(),photo=$("staffPhoto").files[0];if(!body)return;
      if(photo&&(photo.size>8*1024*1024||!photo.type.startsWith('image/')))throw Error('Choose an image smaller than 8 MB.');
      const row=await query(db.from('staff_messages').insert({channel,vehicle_id:vehicleId,author_id:state.user.id,author_name:state.member.display_name,body,reply_to:state.replyTo}).select('id').single());
      state.replyTo=null;
      if(photo){
        const path=`${channel}/${vehicleId||'group'}/${crypto.randomUUID()}.${(photo.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')}`;
        const {error:uploadError}=await db.storage.from('staff-private').upload(path,photo,{contentType:photo.type,upsert:false});
        if(uploadError){await renderPane();throw Error(`Message saved, but photo upload failed: ${uploadError.message}`)}
        try{await query(db.from('staff_attachments').insert({message_id:row.id,object_path:path,uploaded_by:state.user.id}))}
        catch(error){await db.storage.from('staff-private').remove([path]);await renderPane();throw Error(`Message saved, but photo could not be attached: ${error.message}`)}
      }
      await renderPane();
      await loadFollow();
    }catch(error){toast(error.message)}finally{button.disabled=false}
  }
  async function renderExpenses(vehicleId){
    const rows=await query(db.from('staff_expenses').select('id,kind,description,amount,created_at').eq('vehicle_id',vehicleId).order('created_at',{ascending:false}));
    if(state.tab!=='expenses'||state.space?.vehicleId!==vehicleId)return;
    const total=rows.reduce((sum,row)=>sum+Number(row.amount),0);
    $("staffPane").innerHTML=`<p class="staff-summary">Total recorded cost: ${money(total)}</p><form id="staffExpenseForm" class="staff-form"><h3>Add expense</h3><label>Type<select id="staffExpenseKind"><option value="purchase">Purchase</option><option value="repair">Repair</option><option value="transport">Transport</option><option value="other">Other</option></select></label><label>Description<input id="staffExpenseDescription" maxlength="500" required></label><label>Amount (CAD)<input id="staffExpenseAmount" type="number" min="0" step="0.01" required></label><button type="submit">Save expense</button></form><div class="staff-list">${rows.map(row=>`<article class="staff-entry"><strong>${clean(row.kind)} · ${money(row.amount)}</strong><time>${date(row.created_at)}</time><p>${clean(row.description)}</p></article>`).join('')||'<p>No expenses recorded.</p>'}</div>`;
    $("staffExpenseForm").addEventListener('submit',async event=>{event.preventDefault();try{await query(db.from('staff_expenses').insert({vehicle_id:vehicleId,kind:$("staffExpenseKind").value,description:$("staffExpenseDescription").value.trim(),amount:Number($("staffExpenseAmount").value),created_by:state.user.id}));await renderPane()}catch(error){toast(error.message)}});
  }
  async function renderActivity(vehicleId){
    const rows=await query(db.from('staff_sales_activity').select('id,kind,details,created_at').eq('vehicle_id',vehicleId).order('created_at',{ascending:false}));
    if(state.tab!=='activity'||state.space?.vehicleId!==vehicleId)return;
    $("staffPane").innerHTML=`<form id="staffActivityForm" class="staff-form"><h3>Log sales activity</h3><label>Type<select id="staffActivityKind"><option value="inquiry">Inquiry</option><option value="appointment">Appointment</option><option value="test_drive">Test drive</option><option value="sale">Sale update</option><option value="note">Other note</option></select></label><label>Details<textarea id="staffActivityDetails" maxlength="1000" required></textarea></label><button type="submit">Save update</button></form><div class="staff-list">${rows.map(row=>`<article class="staff-entry"><strong>${clean(row.kind.replaceAll('_',' '))}</strong><time>${date(row.created_at)}</time><p>${clean(row.details)}</p></article>`).join('')||'<p>No sales activity yet.</p>'}</div>`;
    $("staffActivityForm").addEventListener('submit',async event=>{event.preventDefault();try{await query(db.from('staff_sales_activity').insert({vehicle_id:vehicleId,kind:$("staffActivityKind").value,details:$("staffActivityDetails").value.trim(),created_by:state.user.id}));await renderPane()}catch(error){toast(error.message)}});
  }
  async function refreshAlerts(){
    if(!state.user)return;
    const rows=await query(db.from('staff_notifications').select('id,kind,message_id,vehicle_id,channel,title,body,created_at,read_at').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(40));
    state.alerts=rows;
    $('staffAlertCount').textContent=String(rows.filter(row=>!row.read_at).length||'');
    $('staffAlertList').innerHTML=rows.map(row=>`<button type="button" class="staff-alert-item ${row.read_at?'':'unread'}" data-alert="${row.id}"><strong>${clean(row.title)}</strong><small>${clean(row.body)} · ${date(row.created_at)}</small></button>`).join('')||'<p>No alerts yet.</p>';
    if(!isOwner()){
      const settings=await query(db.from('staff_notification_settings').select('ready_alerts').eq('user_id',state.user.id).maybeSingle());
      $('staffReadyAlerts').checked=settings?.ready_alerts!==false;
    }
  }
  function vapidBytes(key){
    const base64=key.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-key.length%4)%4);
    return Uint8Array.from(atob(base64),char=>char.charCodeAt(0));
  }
  async function enablePush(){
    const key=window.MO_STAFF_VAPID_PUBLIC_KEY;
    if(!key)throw Error('Phone alerts are not configured yet.');
    if(!window.isSecureContext||!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw Error('This browser does not support web push here. Use the installed app over HTTPS.');
    if(await Notification.requestPermission()!=='granted')throw Error('Notification permission was not granted.');
    const registration=await navigator.serviceWorker.ready;
    const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(key)});
    const json=subscription.toJSON();
    await query(db.from('staff_push_subscriptions').upsert({user_id:state.user.id,endpoint:json.endpoint,p256dh:json.keys.p256dh,auth_secret:json.keys.auth},{onConflict:'endpoint'}));
    toast('This device is subscribed to staff alerts.');
  }
  $("staffLoginForm").addEventListener('submit',async event=>{event.preventDefault();$("staffLoginStatus").textContent='Signing in…';const {error}=await db.auth.signInWithPassword({email:$("staffEmail").value.trim(),password:$("staffPassword").value});if(error){$("staffLoginStatus").textContent=error.message;return}load().catch(error=>showLogin(error.message))});
  $("staffSignOut").addEventListener('click',async()=>{
    try{
      const registration=await navigator.serviceWorker?.ready;
      const subscription=await registration?.pushManager?.getSubscription();
      if(subscription){await db.from('staff_push_subscriptions').delete().eq('user_id',state.user.id).eq('endpoint',subscription.endpoint);await subscription.unsubscribe()}
    }catch(error){toast(`Could not remove phone alerts: ${error.message}`)}
    await db.auth.signOut();state.user=null;showLogin();
  });
  $("staffRefresh").addEventListener('click',()=>refresh().catch(error=>toast(error.message)));
  $("staffSearch").addEventListener('input',renderSidebar);
  $("staffGroups").addEventListener('click',event=>{const button=event.target.closest('[data-channel]');if(button)select({channel:button.dataset.channel,vehicleId:null})});
  $("staffVehicles").addEventListener('click',event=>{const button=event.target.closest('[data-vehicle]');if(button)select({vehicleId:Number(button.dataset.vehicle)})});
  $("staffTabs").addEventListener('click',event=>{const button=event.target.closest('[data-tab]');if(button){state.tab=button.dataset.tab;state.replyTo=null;renderDetail()}});
  $("staffFollow").addEventListener('click',()=>saveFollow({following:!state.follow?.following}).catch(error=>toast(error.message)));
  $("staffMute").addEventListener('click',()=>saveFollow({muted:!state.follow?.muted}).catch(error=>toast(error.message)));
  $("staffAlerts").addEventListener('click',()=>{$('staffAlertPanel').hidden=!$('staffAlertPanel').hidden;refreshAlerts().catch(error=>toast(error.message))});
  $("staffAlertList").addEventListener('click',async event=>{const button=event.target.closest('[data-alert]');if(!button)return;const row=state.alerts.find(item=>item.id===button.dataset.alert);if(!row)return;try{await query(db.from('staff_notifications').update({read_at:new Date().toISOString()}).eq('id',row.id));$('staffAlertPanel').hidden=true;if(row.vehicle_id){select({vehicleId:Number(row.vehicle_id)});if(row.channel&&channels[row.channel]){state.tab=row.channel;renderDetail()}}else if(row.channel)select({channel:row.channel,vehicleId:null});await refreshAlerts()}catch(error){toast(error.message)}});
  $("staffReadyAlerts").addEventListener('change',async event=>{try{await query(db.from('staff_notification_settings').upsert({user_id:state.user.id,ready_alerts:event.target.checked},{onConflict:'user_id'}))}catch(error){toast(error.message)}});
  $("staffEnablePush").addEventListener('click',()=>enablePush().catch(error=>toast(error.message)));
  $("staffReady").addEventListener('click',async()=>{const id=state.space?.vehicleId;if(!id||!isOwner()||!confirm('Give the whole sales team access to this vehicle sales space?'))return;try{await query(db.from('staff_vehicle_state').upsert({vehicle_id:id,ready_for_sale:true,ready_at:new Date().toISOString(),ready_by:state.user.id,updated_at:new Date().toISOString()}));await refresh();toast('Sales team now has access to this vehicle. Website publication was not changed.')}catch(error){toast(error.message)}});
  if('serviceWorker' in navigator)navigator.serviceWorker.register('staff-sw.js',{scope:'./staff.html'}).catch(()=>{});
  if(!window.MO_STAFF_VAPID_PUBLIC_KEY){$('staffEnablePush').disabled=true;$('staffEnablePush').title='A public VAPID key must be configured before phone alerts can be enabled.'}
  load().catch(error=>showLogin(error.message));
})();
