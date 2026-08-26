const financeForm=document.getElementById('financeSettingsForm');
const financeStatus=document.getElementById('financeSettingsStatus');
async function loadFinanceSettings(){
  if(!financeForm||typeof db==='undefined')return;
  const {data,error}=await db.from('finance_settings').select('*').eq('id',1).maybeSingle();
  if(error){financeStatus.textContent=error.message;return;}
  const s=data||{apr:8.99,term_months:84,down_payment:0};
  document.getElementById('financeApr').value=s.apr;
  document.getElementById('financeTerm').value=s.term_months;
  document.getElementById('financeDown').value=s.down_payment;
}
financeForm?.addEventListener('submit',async e=>{
  e.preventDefault(); financeStatus.textContent='Saving…';
  const settings={apr:Number(document.getElementById('financeApr').value),term_months:Number(document.getElementById('financeTerm').value),down_payment:Number(document.getElementById('financeDown').value),updated_at:new Date().toISOString()};
  const {data,error}=await db.from('finance_settings').update(settings).eq('id',1).select().maybeSingle();
  if(error){console.error(error);financeStatus.textContent=error.message;return;}
  if(!data){financeStatus.textContent='Finance settings row was not found.';return;}
  financeStatus.textContent='Saved. All website payment estimates will use these settings.';
  toast('Finance settings saved.');
});
window.loadFinanceSettings=loadFinanceSettings;