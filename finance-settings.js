(()=>{
  let bound=false;
  const $=id=>document.getElementById(id);
  const defaults=MOMotorsFinance.DEFAULTS;
  const getForm=()=>$('financeSettingsForm');
  const getStatus=()=>$('financeSettingsStatus');

  async function loadFinanceSettings(){
    if(!getForm()||typeof db==='undefined')return;
    const status=getStatus();
    if(status)status.textContent='Loading current settings…';
    const settings=await MOMotorsFinance.load({fresh:true});
    $('financeApr').value=settings.apr;
    $('financeTerm').value=settings.term_months;
    $('financeDown').value=settings.down_payment;
    $('financeFee').value=settings.financing_fee;
    $('financeFrequency').value=settings.payment_frequency;
    if(status)status.textContent='';
  }

  function bind(){
    const form=getForm();if(!form||bound)return;bound=true;
    form.addEventListener('submit',async e=>{
      e.preventDefault();const status=getStatus();if(status)status.textContent='Saving…';
      const settings={apr:Number($('financeApr').value),term_months:Number($('financeTerm').value),down_payment:Number($('financeDown').value),financing_fee:Number($('financeFee').value),payment_frequency:$('financeFrequency').value,updated_at:new Date().toISOString()};
      const {data,error}=await db.from('finance_settings').update(settings).eq('id',1).select().maybeSingle();
      if(error){console.error(error);if(status)status.textContent=error.message;return}
      if(!data){if(status)status.textContent='Finance settings could not be saved.';return}
      if(status)status.textContent='Saved. Website payment estimates now use these defaults.';
      if(typeof toast==='function')toast('Finance settings saved.');
    });
  }

  function init(){if(!getForm()){setTimeout(init,100);return}bind();loadFinanceSettings()}
  document.addEventListener('DOMContentLoaded',init);
  window.addEventListener('adminpanelsready',init);
  window.loadFinanceSettings=async()=>{bind();return loadFinanceSettings()};
})();
