(()=>{
  const defaults=MOMotorsFinance.DEFAULTS;
  const money=n=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.max(0,Number(n)||0));
  const frequencyValue=value=>value==="weekly"?52:value==="monthly"?12:26;
  let settings=defaults,boundPanel=null;

  async function loadSettings(){
    settings=await MOMotorsFinance.load();
    apply();
  }

  function apply(){
    const root=document.getElementById("vehicleDetail"),panel=document.getElementById("purchaseOptions"),priceText=root?.querySelector(".detail-price strong")?.textContent;
    if(!root||!panel||!priceText)return;
    const vehicleId=new URLSearchParams(location.search).get("id"),purchaseLink=panel.querySelector("#poCta");
    if(vehicleId&&purchaseLink&&purchaseLink.getAttribute("href")?.startsWith("pre-approval.html"))purchaseLink.href=`pre-approval.html?vehicle=${encodeURIComponent(vehicleId)}`;
    const listedPrice=Number(priceText.replace(/[^0-9.]/g,""))||0;
    const $=id=>panel.querySelector("#"+id);
    if(!$("poDown")||!$("poRate")||!$("poTerm")||!$("poFreq"))return;

    let priceInput=$("poVehiclePrice");
    if(!priceInput){
      const label=document.createElement("label");
      label.innerHTML=`Vehicle price<input id="poVehiclePrice" type="number" min="0" step="100" value="${listedPrice}">`;
      panel.querySelector(".payment-grid")?.prepend(label);
      priceInput=$("poVehiclePrice");
    }
    let feeInput=$("poFinancingFee");
    if(!feeInput){
      const label=document.createElement("label");
      label.className="finance-only";
      label.innerHTML='Financing fee<input id="poFinancingFee" type="number" min="0" step="0.01" value="0">';
      panel.querySelector(".payment-grid")?.append(label);
      feeInput=$("poFinancingFee");
    }
    let warrantyInput=$("poWarranty");
    if(!warrantyInput){
      const label=document.createElement("label");
      label.innerHTML='Warranty (optional)<input id="poWarranty" type="number" min="0" step="0.01" value="0">';
      panel.querySelector(".payment-grid")?.append(label);
      warrantyInput=$("poWarranty");
    }
    const help=panel.querySelector(".option-help");
    if(help)help.textContent="Adjust vehicle price and optional warranty in either tab. Financing fee applies only to Finance.";

    $("poDown").value=settings.down_payment;
    $("poRate").value=settings.apr;
    feeInput.value=settings.financing_fee;
    if(![...$("poTerm").options].some(option=>Number(option.value)===Number(settings.term_months)))$("poTerm").add(new Option(`${settings.term_months} months`,settings.term_months));
    $("poTerm").value=String(settings.term_months);
    $("poFreq").value=String(frequencyValue(settings.payment_frequency));

    let feeRow=$("poFee")?.closest("div");
    if(!feeRow){feeRow=document.createElement("div");feeRow.innerHTML='<span>Financing fee</span><b id="poFee"></b>';$("poPst").closest("div").after(feeRow)}
    let warrantyRow=$("poWarrantyOut")?.closest("div");
    if(!warrantyRow){warrantyRow=document.createElement("div");warrantyRow.innerHTML='<span>Warranty</span><b id="poWarrantyOut"></b>';feeRow.before(warrantyRow)}

    const calculate=()=>{
      const cashMode=panel.querySelector('[data-mode="cash"]')?.classList.contains("active");
      const enteredPrice=Number(priceInput?.value),vehiclePrice=Number.isFinite(enteredPrice)&&enteredPrice>=0?enteredPrice:listedPrice;
      const down=Math.max(0,+$("poDown").value||0),trade=Math.max(0,+$("poTrade").value||0),rate=Math.max(0,+$("poRate").value||0),months=+$("poTerm").value||84,periods=+$("poFreq").value||26,withTax=$("poTax").value==="yes",warranty=Math.max(0,+warrantyInput.value||0);
      const custom=MOMotorsFinance.normalize({...settings,apr:rate,term_months:months,financing_fee:Math.max(0,+feeInput.value||0),payment_frequency:periods===52?"weekly":periods===12?"monthly":"biweekly"}),result=MOMotorsFinance.calculate({price:vehiclePrice,warranty,down,trade,includeTax:withTax,includeFee:!cashMode,settings:custom}),gst=withTax?(vehiclePrice+warranty)*.05:0,pst=withTax?(vehiclePrice+warranty)*.07:0,fee=result.fee,principal=result.principal,payment=result.payment;
      feeRow.hidden=cashMode;feeRow.style.display=cashMode?"none":"";
      $("poPrice").textContent=money(vehiclePrice);$("poGst").textContent=money(gst);$("poPst").textContent=money(pst);$("poWarrantyOut").textContent=money(warranty);$("poFee").textContent=money(fee);$("poDownOut").textContent="− "+money(down);$("poTradeOut").textContent="− "+money(trade);$("poPayment").textContent=cashMode?money(principal):money(payment);$("poFrequencyLabel").textContent=cashMode?"before any applicable registration or third-party charges":periods===52?"weekly":periods===12?"monthly":"bi-weekly";$("poFinanced").textContent=money(principal);
      if(cashMode)$("poDisclaimer").textContent="Cash estimate includes the optional warranty and estimated GST/PST when selected. Actual warranty availability, taxes and final price require confirmation.";
      if(!cashMode){
        if(vehicleId&&purchaseLink)purchaseLink.href=`pre-approval.html?vehicle=${encodeURIComponent(vehicleId)}`;
        const topPayment=root.querySelector(".detail-price span");
        if(topPayment)topPayment.innerHTML=`or <b>${money(payment)}</b> ${periods===52?"weekly":periods===12?"monthly":"bi-weekly"}`;
        $("poDisclaimer").textContent=`Estimate includes optional warranty, GST/PST when selected, and a ${money(fee)} financing fee. Actual warranty availability, taxes and financing terms require confirmation and lender approval. OAC.`;
      }
    };

    if(boundPanel!==panel){
      boundPanel=panel;observer.disconnect();
      ["poVehiclePrice","poDown","poTrade","poFinancingFee","poWarranty","poRate","poTerm","poFreq","poTax"].forEach(fieldId=>$(fieldId)?.addEventListener("input",()=>setTimeout(calculate)));
      panel.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>setTimeout(calculate)));
    }
    calculate();
  }

  const observer=new MutationObserver(()=>{if(document.getElementById("purchaseOptions")!==boundPanel)apply()});
  observer.observe(document.getElementById("vehicleDetail"),{childList:true,subtree:true});
  loadSettings();
})();
