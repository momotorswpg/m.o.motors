(()=>{
  const db=supabase.createClient('https://dpsgtliddmdvfwjahkkq.supabase.co','sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0'),$=id=>document.getElementById(id),id=new URLSearchParams(location.search).get('id');
  let applicantName='this applicant';
  const sections=[
    ['Applicant information',[['first_name','First name'],['last_name','Last name'],['date_of_birth','Date of birth','date'],['marital_status','Marital status'],['phone','Phone'],['email','Email']]],
    ['Current residence',[['address','Street address','wide'],['city','City'],['province','Province'],['postal_code','Postal code'],['address_duration','Time at address'],['housing_status','Housing status'],['housing_payment','Monthly housing payment','money']]],
    ['Previous residence',[['previous_address','Street address','wide'],['previous_city','City'],['previous_province','Province'],['previous_postal_code','Postal code'],['previous_address_duration','Time at previous address']]],
    ['Current employment',[['employment_status','Employment status'],['employer','Employer'],['occupation','Occupation'],['employment_duration','Employment duration'],['monthly_income','Gross monthly income','money']]],
    ['Previous employment',[['previous_employer','Previous employer'],['previous_occupation','Previous occupation'],['previous_employment_duration','Employment duration']]],
    ['Financial background',[['credit_rating','Self-reported credit'],['bankruptcy','Bankruptcy'],['repossession','Repossession']]],
    ['Vehicle and purchase',[['vehicle_interest','Vehicle of interest','wide'],['vehicle_price','Vehicle price','money'],['down_payment','Down payment','money'],['trade_in','Trade-in'],['trade_value','Estimated trade value','money']]],
    ['Co-signer',[['has_cosigner','Co-signer included','yesno'],['cosigner_first_name','First name'],['cosigner_last_name','Last name'],['cosigner_date_of_birth','Date of birth','date'],['cosigner_phone','Phone'],['cosigner_email','Email'],['cosigner_address','Address','wide'],['cosigner_city','City'],['cosigner_province','Province'],['cosigner_postal_code','Postal code'],['cosigner_employment_status','Employment status'],['cosigner_employer','Employer'],['cosigner_occupation','Occupation'],['cosigner_monthly_income','Gross monthly income','money']]],
    ['Consent and notes',[['credit_consent','Credit consent','consent'],['marketing_consent','Marketing consent','consent'],['consented_at','Consent recorded','datetime'],['notes','Applicant notes','wide']]]
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),present=v=>v!==null&&v!==undefined&&v!=='';
  const date=v=>new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'}),datetime=v=>new Date(v).toLocaleString('en-CA',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}),money=v=>new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',minimumFractionDigits:2}).format(Number(v)||0);
  function display(v,t){if(t==='money')return money(v);if(t==='date')return date(v);if(t==='datetime')return datetime(v);if(t==='yesno'||t==='consent')return v?'Yes':'No';return String(v)}
  function section(row,[title,fields]){const shown=fields.filter(([key])=>present(row[key]));if(!shown.length)return'';return `<section class="finance-section"><h3>${esc(title)}</h3><div class="finance-data-grid">${shown.map(([key,label,type])=>`<div class="finance-data-item${type==='wide'?' wide':''}"><span>${esc(label)}</span><strong class="${type==='consent'?(row[key]?'finance-consent-yes':'finance-consent-no'):''}">${esc(display(row[key],type))}</strong></div>`).join('')}</div></section>`}
  async function init(){
    const{data:{user}}=await db.auth.getUser();if(!user){location.replace('finance-admin-login.html');return}$('account').textContent=`Signed in as ${user.email}`;
    if(!id){$('applicationSheet').innerHTML='<div class="finance-admin-empty">No application was selected.</div>';return}
    const{data:row,error}=await db.from('finance_applications').select('*').eq('id',id).single();if(error||!row){$('applicationSheet').innerHTML=`<div class="finance-admin-empty">Application could not be loaded.${error?` ${esc(error.message)}`:''}</div>`;return}
    const name=`${row.first_name||''} ${row.last_name||''}`.trim()||'Unnamed applicant';applicantName=name;document.title=`${name} Finance Application | M.O Motors`;
    $('applicationSheet').innerHTML=`<header class="finance-application-sheet-head"><div><span class="eyebrow red">FINANCE APPLICATION</span><h1>${esc(name)}</h1><p>Submitted ${esc(datetime(row.created_at))} · Status: ${esc(row.status||'New')}</p></div><div class="finance-print-brand"><span class="finance-print-logo"><img src="mo-motors-logo.png" alt="M.O Motors Certified Pre-Owned Vehicles"></span><span>Unit 104, 420 Des Meurons St<br>Winnipeg, MB R2H 2N9</span></div></header>${sections.map(s=>section(row,s)).join('')}<p class="finance-application-id">Application ID: ${esc(row.id)}</p>`;
    $('deleteApplication').disabled=false;
  }
  async function deleteApplication(){
    const button=$('deleteApplication'),message=$('deleteMessage');
    if(!id||button.disabled)return;
    if(!confirm(`Permanently delete the entire finance application for ${applicantName}?\n\nThis removes all personal, employment, financial and consent information. This action cannot be undone.`))return;
    button.disabled=true;button.textContent='Deleting…';message.textContent='';
    const{data,error}=await db.from('finance_applications').delete().eq('id',id).select('id');
    if(error||!data?.length){message.textContent=error?.message||'The application was not deleted. Please try again.';button.disabled=false;button.textContent='Delete Application';return}
    location.replace('finance-admin.html?deleted=1');
  }
  $('printApplication').addEventListener('click',()=>window.print());$('deleteApplication').addEventListener('click',deleteApplication);init();
})();
