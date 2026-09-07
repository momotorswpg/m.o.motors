(()=>{
  const mobile=()=>matchMedia('(max-width: 800px)').matches;
  const surfaceSelector='.vehicle-image[data-gallery],.detail-main-image,.fullscreen-photo-stage';
  let gesture=null,suppressClickUntil=0;

  function changePhoto(surface,direction){
    if(surface.matches('.vehicle-image[data-gallery]')){
      surface.querySelector(direction>0?'.card-gallery-arrow.next':'.card-gallery-arrow.prev')?.click();
      return;
    }
    if(surface.matches('.detail-main-image')){
      const thumbs=[...document.querySelectorAll('.detail-thumb')];
      if(thumbs.length<2)return;
      const current=Math.max(0,thumbs.findIndex(thumb=>thumb.classList.contains('active')));
      thumbs[(current+direction+thumbs.length)%thumbs.length].click();
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
})();
