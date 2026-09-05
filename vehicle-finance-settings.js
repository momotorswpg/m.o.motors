(()=>{
  const URL="https://dpsgtliddmdvfwjahkkq.supabase.co",KEY="sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0";
  const defaults={apr:8.99,term_months:84,down_payment:0,financing_fee:1000,payment_frequency:"biweekly"};
  const money=n=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.max(0,Number(n)||0));
  const frequencyValue=value=>value==="weekly"?52:value==="monthly"?12:26;
  const frequencyLabel=value=>value==="weekly"?"weekly":value==="monthly"?"monthly":"bi-weekly";
  let settings=defaults,boundPanel=null;

  async function loadSettings(){
    try{
      const response=await fetch(`${URL}/rest/v1/finance_settings?select=*&id=eq.1`,{headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}});
      if(!response.ok)throw new Error(await response.text());
      settings={...defaults,...((await response.json())[0]||{})};
    }catch(error){console.warn("Using default finance settings",error)}
    apply();
  }

  function apply(){
    const root=document.getElementById("vehicleDetail"),panel=document.getElementById("purchaseOptions"),priceText=root?.querySelector(".detail-price strong")?.textContent;
    if(!root||!panel||!priceText)return;
    const base=Number(priceText.replace(/[^0-9.]/g,""))||0;
    const $=id=>panel.querySelector("#"+id);
    if(!$("poDown")||!$("poRate")||!$("poTerm")||!$("poFreq"))return;
    $("poDown").value=settings.down_payment;
    $("poRate").value=settings.apr;
    if(![...$("poTerm").options].some(option=>Number(option.value)===Number(settings.term_months))){$("poTerm").add(new Option(`${settings.term_months} months`,settings.term_months))}
    $("poTerm").value=String(settings.term_months);
    $("poFreq").value=String(frequencyValue(settings.payment_frequency));
    let feeRow=$("poFee")?.closest("div");
    if(!feeRow){feeRow=document.createElement("div");feeRow.innerHTML='<span>Financing fee</span><b id="poFee"></b>';$("poPst").closest("div").after(feeRow)}

    const calculate=()=>{
      const down=+$("poDown").value||0,trade=+$("poTrade").value||0,rate=+$("poRate").value||0,months=+$("poTerm").value||84,periods=+$("poFreq").value||26,withTax=$("poTax").value==="yes";
      const cashMode=panel.querySelector('[data-mode="cash"]')?.classList.contains("active"),gst=withTax?base*.05:0,pst=withTax?base*.07:0,fee=cashMode?0:Number(settings.financing_fee)||0,principal=Math.max(0,base+gst+pst+fee-down-trade),periodicRate=rate/100/periods,payments=months/12*periods,payment=periodicRate?principal*periodicRate/(1-Math.pow(1+periodicRate,-payments)):principal/payments;
      feeRow.hidden=cashMode;
      $("poGst").textContent=money(gst);$("poPst").textContent=money(pst);$("poFee").textContent=money(fee);$("poDownOut").textContent="− "+money(down);$("poTradeOut").textContent="− "+money(trade);$("poPayment").textContent=money(payment);$("poFrequencyLabel").textContent=periods===52?"weekly":periods===12?"monthly":"bi-weekly";$("poFinanced").textContent=money(principal);
      const topPayment=root.querySelector(".detail-price span");if(topPayment)topPayment.innerHTML=`or <b>${money(payment)}</b> ${periods===52?"weekly":periods===12?"monthly":"bi-weekly"}`;
      if(!cashMode)$("poDisclaimer").textContent=`Price includes GST/PST when selected and a ${money(fee)} financing fee. Estimate uses ${months} months and is subject to lender approval. OAC.`;
    };
    if(boundPanel!==panel){boundPanel=panel;observer.disconnect();["poDown","poTrade","poRate","poTerm","poFreq","poTax"].forEach(id=>$(id).addEventListener("input",()=>setTimeout(calculate)));panel.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>setTimeout(calculate)));}
    calculate();
  }

  const observer=new MutationObserver(()=>{if(document.getElementById("purchaseOptions")!==boundPanel)apply()});
  observer.observe(document.getElementById("vehicleDetail"),{childList:true,subtree:true});
  loadSettings();
})();
