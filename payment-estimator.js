(() => {
  const $=id=>document.getElementById(id),fmt=n=>new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
  let settings=MOMotorsFinance.normalize();
  const frequencyValue=value=>MOMotorsFinance.frequency(value).periods;
  const frequencyName=periods=>periods===52?"weekly":periods===12?"monthly":"biweekly";

  function calculate(){
    const custom=MOMotorsFinance.normalize({...settings,apr:+$('rate').value||0,term_months:+$('term').value||settings.term_months,financing_fee:Math.max(0,+$('financingFee').value||0),payment_frequency:frequencyName(+$('frequency').value)});
    const result=MOMotorsFinance.calculate({price:+$('price').value||0,warranty:+$('warranty').value||0,down:+$('down').value||0,trade:+$('trade').value||0,includeTax:$('tax').value==='yes',settings:custom});
    $('financed').textContent=fmt(result.principal);$('payment').textContent=`${fmt(result.payment)} ${result.label}`;$('interest').textContent=fmt(result.total-result.principal);$('total').textContent=fmt(result.total);$('fee').textContent=fmt(result.fee);$('warrantyOut').textContent=fmt(result.warranty);
  }

  async function init(){
    settings=await MOMotorsFinance.load();
    $('down').value=settings.down_payment;$('rate').value=settings.apr;$('financingFee').value=settings.financing_fee;
    if(![...$('term').options].some(option=>Number(option.value)===settings.term_months))$('term').add(new Option(`${settings.term_months} months`,settings.term_months));
    $('term').value=String(settings.term_months);$('frequency').value=String(frequencyValue(settings.payment_frequency));
    ['price','down','trade','financingFee','warranty','rate','term','frequency','tax'].forEach(id=>$(id).addEventListener('input',calculate));calculate();
  }
  init();
})();
