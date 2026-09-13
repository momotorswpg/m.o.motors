export function sameSecret(a,b){
  const left=new TextEncoder().encode(a),right=new TextEncoder().encode(b);
  let different=left.length^right.length;
  for(let i=0;i<Math.max(left.length,right.length);i++)different|=(left[i]||0)^(right[i]||0);
  return different===0&&left.length>0;
}

export function safeEndpoint(value){
  try{
    const endpoint=new URL(value);
    return endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password&&!endpoint.port&&
      ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(endpoint.hostname);
  }catch{return false}
}
