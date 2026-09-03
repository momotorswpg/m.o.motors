(()=>{
  const modal=document.getElementById("warrantyModal");
  const dialog=modal?.querySelector(".warranty-modal-dialog");
  const select=document.getElementById("warrantyCoverageLevel");
  let opener=null;
  if(!modal||!dialog||!select)return;

  function openModal(button){
    opener=button;
    select.value=button.dataset.warrantyPlan||"";
    modal.hidden=false;
    document.body.classList.add("warranty-modal-open");
    requestAnimationFrame(()=>modal.classList.add("is-open"));
    setTimeout(()=>dialog.querySelector('input[name="first_name"]')?.focus(),100);
  }

  function closeModal(){
    modal.classList.remove("is-open");
    document.body.classList.remove("warranty-modal-open");
    setTimeout(()=>{modal.hidden=true;opener?.focus();opener=null},180);
  }

  document.querySelectorAll("[data-warranty-plan]").forEach(button=>button.addEventListener("click",()=>openModal(button)));
  modal.querySelectorAll("[data-warranty-close]").forEach(button=>button.addEventListener("click",closeModal));
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!modal.hidden)closeModal()});
  dialog.addEventListener("keydown",event=>{
    if(event.key!=="Tab")return;
    const focusable=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')];
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });
})();
