import { createClient } from 'npm:@supabase/supabase-js@2.110.6';
import { sendNotification } from 'npm:web-push@3.6.7';
import { sameSecret, safeEndpoint } from './core.mjs';

const env=name=>Deno.env.get(name)||'';
function response(status,body){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})}

Deno.serve(async request=>{
  if(request.method!=='POST')return response(405,{error:'POST required'});
  const secret=env('STAFF_PUSH_DISPATCH_SECRET');
  if(!secret||!sameSecret(request.headers.get('x-staff-dispatch-secret')||'',secret))return response(401,{error:'Unauthorized'});
  const url=env('SUPABASE_URL'),serviceKey=env('SUPABASE_SERVICE_ROLE_KEY');
  const publicKey=env('STAFF_VAPID_PUBLIC_KEY'),privateKey=env('STAFF_VAPID_PRIVATE_KEY'),subject=env('STAFF_VAPID_SUBJECT');
  if(!url||!serviceKey||!publicKey||!privateKey||!subject)return response(503,{error:'Push delivery not configured'});
  const db=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const stale=new Date(Date.now()-5*60*1000).toISOString();
  const {data:pending,error:listError}=await db.from('staff_notifications')
    .select('id,user_id,title,body,kind,vehicle_id,channel')
    .is('push_sent_at',null).or(`push_processing_at.is.null,push_processing_at.lt.${stale}`)
    .order('created_at',{ascending:true}).limit(30);
  if(listError)return response(500,{error:'Could not read notification queue'});
  let sent=0,failed=0;
  for(const notice of pending||[]){
    const {data:claim,error:claimError}=await db.from('staff_notifications')
      .update({push_processing_at:new Date().toISOString()}).eq('id',notice.id).is('push_sent_at',null)
      .or(`push_processing_at.is.null,push_processing_at.lt.${stale}`).select('id').maybeSingle();
    if(claimError||!claim)continue;
    // Service-role reads bypass RLS, so recheck today's role before delivering
    // a queued message. This also covers an owner later changed to sales.
    const {data:member,error:memberError}=await db.from('staff_members').select('role').eq('user_id',notice.user_id).maybeSingle();
    let allowed=member?.role==='owner'||(member?.role==='sales'&&(notice.kind==='ready'||notice.channel==='sales_group'));
    if(member?.role==='sales'&&notice.channel==='sales_vehicle'&&notice.vehicle_id){
      const {data:ready,error:readyError}=await db.from('staff_vehicle_state').select('ready_for_sale').eq('vehicle_id',notice.vehicle_id).maybeSingle();
      if(readyError){failed++;continue}
      allowed=Boolean(ready?.ready_for_sale);
    }
    if(memberError){failed++;continue}
    if(!allowed){await db.from('staff_notifications').update({push_sent_at:new Date().toISOString(),push_processing_at:null}).eq('id',notice.id);continue}
    const {data:subscriptions,error:subError}=await db.from('staff_push_subscriptions')
      .select('id,endpoint,p256dh,auth_secret').eq('user_id',notice.user_id);
    if(subError){failed++;continue}
    let complete=true;
    const destination=`/staff.html${notice.vehicle_id?`?vehicle=${encodeURIComponent(notice.vehicle_id)}`:notice.channel?`?channel=${encodeURIComponent(notice.channel)}`:''}`;
    // Lock screens can be visible to others. Never include chat or customer
    // details in the external push payload; the signed-in inbox has the text.
    const payload=JSON.stringify({id:notice.id,title:notice.title,body:'Open the private staff workspace to review this update.',url:destination});
    for(const subscription of subscriptions||[]){
      if(!safeEndpoint(subscription.endpoint)){
        await db.from('staff_push_subscriptions').delete().eq('id',subscription.id);
        continue;
      }
      try{
        await sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth_secret}},payload,
          {vapidDetails:{subject,publicKey,privateKey},TTL:3600});
      }catch(error){
        if(error?.statusCode===404||error?.statusCode===410){
          await db.from('staff_push_subscriptions').delete().eq('id',subscription.id);
        }else complete=false;
      }
    }
    if(complete){
      const {error:doneError}=await db.from('staff_notifications').update({push_sent_at:new Date().toISOString(),push_processing_at:null}).eq('id',notice.id);
      if(doneError)failed++;else sent++;
    }else failed++;
  }
  return response(200,{processed:(pending||[]).length,sent,failed});
});
