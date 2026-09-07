(()=>{
  const mobile=()=>matchMedia('(max-width: 800px)').matches;
  const surfaceSelector='.vehicle-image[data-gallery],.detail-main-image,.fullscreen-photo-stage';
  let gesture=null,suppressClickUntil=0;

  function ensureDetailArrows(){
    const surface=document.querySelector('.detail-main-image'),thumbs=document.querySelectorAll('.detail-thumb');
    if(!surface)return;
    if(!mobile()||thumbs.length<2){surface.querySelectorAll('.mobile-detail-arrow').forEach(button=>button.remove());return}
    if(surface.querySelector('.mobile-detail-arrow'))return;
    [['prev','gallery-prev','Previous photo',-1],['next','gallery-next','Next photo',1]].forEach(([side,position,label,direction])=>{
      const button=document.createElement('button');
      button.type='button';button.className=`gallery-arrow ${position} mobile-detail-arrow ${side}`;button.setAttribute('aria-label',label);button.textContent=direction>0?'›':'‹';
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();changePhoto(surface,direction)});
      surface.append(button);
    });
  }

  function changePhoto(surface,direction){
    if(surface.matches('.vehicle-image[data-gallery]')){
      surface.querySelector(direction>0?'.card-gallery-arrow.next':'.card-gallery-arrow.prev')?.click();
      return;
    }
    if(surface.matches('.detail-main-image')){
      const thumbs=[...document.querySelectorAll('.detail-thumb')];
      if(thumbs.length<2)return;
      const current=Math.max(0,thumbs.findIndex(thumb=>thumb.classList.contains('active')));
      const next=thumbs[(current+direction+thumbs.length)%thumbs.length],nextImage=next.querySelector('img'),main=document.getElementById('mainVehiclePhoto');
      if(!nextImage||!main)return;
      main.src=nextImage.currentSrc||nextImage.src;
      thumbs.forEach(thumb=>thumb.classList.toggle('active',thumb===next));
      next.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
      return;
    }
    document.querySelector(direction>0?'.lightbox-nav.next':'.lightbox-nav.prev')?.click();
  }

  document.addEventListener('pointerdown',event=>{
    if(!mobile()||!event.isPrimary)return;
    const surface=event.target.closest(surfaceSelector);
    if(!surface)return;
    gesture={surface,pointerId:event.pointerId,x:event.clientX,y:event.clientY,time:Date.now()};
  });

  document.addEventListener('pointerup',event=>{
    if(!gesture||!mobile()||event.pointerId!==gesture.pointerId){gesture=null;return}
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y,elapsed=Date.now()-gesture.time;
    if(elapsed<1000&&Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.2){
      changePhoto(gesture.surface,dx<0?1:-1);
      suppressClickUntil=Date.now()+500;
    }
    gesture=null;
  });

  document.addEventListener('pointercancel',()=>{gesture=null});
  document.addEventListener('click',event=>{
    if(Date.now()<suppressClickUntil&&event.target.closest(surfaceSelector)){
      event.preventDefault();event.stopImmediatePropagation();
    }
  },true);

  new MutationObserver(ensureDetailArrows).observe(document.body,{childList:true,subtree:true});
  addEventListener('resize',ensureDetailArrows);
  ensureDetailArrows();
})();
