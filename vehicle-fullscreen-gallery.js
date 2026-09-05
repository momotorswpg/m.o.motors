(()=>{
  const box=document.getElementById('lightbox'),image=document.getElementById('lightboxImage'),stage=box?.querySelector('.fullscreen-photo-stage'),count=document.getElementById('fullscreenPhotoCount'),actual=document.getElementById('fullscreenActualSize'),original=document.getElementById('fullscreenOpenOriginal');
  if(!box||!image||!stage)return;
  let photos=[],current=0,zoomed=false,lastFocus=null;
  const collect=()=>{const thumbnails=[...document.querySelectorAll('.detail-thumb img')].map(img=>img.currentSrc||img.src).filter(Boolean),main=document.getElementById('mainVehiclePhoto'),urls=thumbnails.length?thumbnails:(main?[main.currentSrc||main.src]:[]);photos=[...new Set(urls)]};
  function setZoom(value){zoomed=value;box.classList.toggle('actual-size',zoomed);actual.textContent=zoomed?'Fit to screen':'View actual size'}
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
  image.addEventListener('click',()=>setZoom(!zoomed));
  box.addEventListener('click',event=>{if(event.target===box)close()});
  document.addEventListener('keydown',event=>{if(box.hidden)return;if(event.key==='Escape')close();if(event.key==='ArrowLeft')show(current-1);if(event.key==='ArrowRight')show(current+1)});
})();
