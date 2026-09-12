(()=>{
  const box=document.getElementById('lightbox'),image=document.getElementById('lightboxImage'),stage=box?.querySelector('.fullscreen-photo-stage'),count=document.getElementById('fullscreenPhotoCount'),actual=document.getElementById('fullscreenActualSize'),original=document.getElementById('fullscreenOpenOriginal');
  if(!box||!image||!stage)return;
  let photos=[],current=0,zoomed=false,lastFocus=null,drag=null,suppressClick=false;
  const collect=()=>{const thumbnails=[...document.querySelectorAll('.detail-thumb img')].map(img=>img.currentSrc||img.src).filter(Boolean),main=document.getElementById('mainVehiclePhoto'),urls=thumbnails.length?thumbnails:(main?[main.currentSrc||main.src]:[]);photos=[...new Set(urls)]};
  function setZoom(value,point){
    const rect=image.getBoundingClientRect();
    const focus=point?{x:(point.x-rect.left)/rect.width,y:(point.y-rect.top)/rect.height}:null;
    zoomed=value;
    box.classList.toggle('actual-size',zoomed);
    actual.textContent=zoomed?'Fit to screen':'View actual size';
    stage.scrollTo(0,0);
    if(zoomed){
      requestAnimationFrame(()=>{
        const imageRect=image.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
        const x=focus?focus.x:0.5,y=focus?focus.y:0.5;
        const targetX=focus?point.x:stageRect.left+stageRect.width/2;
        const targetY=focus?point.y:stageRect.top+stageRect.height/2;
        stage.scrollLeft=imageRect.left+x*imageRect.width-targetX;
        stage.scrollTop=imageRect.top+y*imageRect.height-targetY;
      });
    }
  }
  function show(index){if(!photos.length)return;current=(index+photos.length)%photos.length;image.src=photos[current];image.alt=`Full-resolution vehicle photo ${current+1} of ${photos.length}`;count.textContent=`${current+1} / ${photos.length}`;original.href=photos[current];setZoom(false);box.querySelectorAll('.lightbox-nav').forEach(button=>button.hidden=photos.length<2)}
  function open(index){collect();if(!photos.length)return;lastFocus=document.activeElement;show(index);box.hidden=false;document.body.classList.add('fullscreen-gallery-open');box.querySelector('.lightbox-close')?.focus()}
  function close(){box.hidden=true;document.body.classList.remove('fullscreen-gallery-open');setZoom(false);lastFocus?.focus?.()}
  document.addEventListener('click',event=>{
    const main=event.target.closest('#mainVehiclePhoto');
    const thumb=event.target.closest('.detail-thumb');
    if(!main&&!thumb)return;
    event.preventDefault();event.stopImmediatePropagation();
    collect();
    const index=thumb?Math.max(0,[...document.querySelectorAll('.detail-thumb')].indexOf(thumb)):Math.max(0,photos.indexOf(main.currentSrc||main.src));
    open(index);
  },true);
  box.querySelector('.lightbox-close')?.addEventListener('click',close);
  box.querySelector('.lightbox-nav.prev')?.addEventListener('click',()=>show(current-1));
  box.querySelector('.lightbox-nav.next')?.addEventListener('click',()=>show(current+1));
  actual?.addEventListener('click',()=>setZoom(!zoomed));
  image.addEventListener('click',event=>{
    if(suppressClick){suppressClick=false;return}
    setZoom(!zoomed,zoomed?null:{x:event.clientX,y:event.clientY});
  });
  stage.addEventListener('pointerdown',event=>{
    if(!zoomed||event.button!==0)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:stage.scrollLeft,top:stage.scrollTop,moved:false};
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.abs(dx)>4||Math.abs(dy)>4)drag.moved=true;
    if(drag.moved){stage.scrollLeft=drag.left-dx;stage.scrollTop=drag.top-dy}
  });
  function endDrag(event){
    if(!drag||event.pointerId!==drag.id)return;
    if(drag.moved){suppressClick=true;setTimeout(()=>{suppressClick=false},0)}
    drag=null;
  }
  stage.addEventListener('pointerup',endDrag);
  stage.addEventListener('pointercancel',endDrag);
  box.addEventListener('click',event=>{if(event.target===box)close()});
  document.addEventListener('keydown',event=>{if(box.hidden)return;if(event.key==='Escape')close();if(event.key==='ArrowLeft')show(current-1);if(event.key==='ArrowRight')show(current+1)});
})();
