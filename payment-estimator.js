(()=>{
  const URL="https://dpsgtliddmdvfwjahkkq.supabase.co",KEY="sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0";
  const defaults={apr:8.99,term_months:84,down_payment:0,financing_fee:1000,payment_frequency:"biweekly"};
  const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
  let settings=defaults;
  const frequencyValue=value=>value==="weekly"?52:value==="monthly"?12:26;

  function calculate(){
    const price=+$('price').value||0,down=+$('down').value||0,trade=+$('trade').value||0,rate=+$('rate').value||0,months=+$('term').value||84,frequency=+$('frequency').value||26,taxRate=$('tax').value==='yes'?.12:0,fee=Number(settings.financing_fee)||0;
    const principal=Math.max(0,price*(1+taxRate)+fee-down-trade),payments=months/12*frequency,periodicRate=rate/100/frequency,payment=periodicRate?principal*periodicRate/(1-Math.pow(1+periodicRate,-payments)):principal/payments,total=payment*payments;
    $('financed').textContent=fmt(principal);$('payment').textContent=fmt(payment)+(frequency===26?' bi-weekly':frequency===52?' weekly':' monthly');$('interest').textContent=fmt(total-principal);$('total').textContent=fmt(total);$('fee').textContent=fmt(fee);
  }

  async function init(){
    try{const response=await fetch(`${URL}/rest/v1/finance_settings?select=*&id=eq.1`,{headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}});if(!response.ok)throw new Error(await response.text());settings={...defaults,...((await response.json())[0]||{})}}catch(error){console.warn('Using default finance settings',error)}
    $('down').value=settings.down_payment;$('rate').value=settings.apr;
    if(![...$('term').options].some(option=>Number(option.value)===Number(settings.term_months)))$('term').add(new Option(`${settings.term_months} months`,settings.term_months));
    $('term').value=String(settings.term_months);$('frequency').value=String(frequencyValue(settings.payment_frequency));
    ['price','down','trade','rate','term','frequency','tax'].forEach(id=>$(id).addEventListener('input',calculate));calculate();
  }
  init();
})();
