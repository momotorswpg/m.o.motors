(()=>{
  document.querySelectorAll('.brand-tagline').forEach(tagline=>{tagline.textContent='CERTIFIED PRE-OWNED VEHICLES'});
  document.querySelectorAll('.hero-line .accent').forEach(accent=>{accent.textContent=accent.textContent.replace(/\./g,'')});

  const nav=document.getElementById('nav');
  const menuBtn=document.getElementById('menuBtn');
  const mainNav=document.querySelector('.site-header .main-nav');
  let mobileContact=mainNav?.querySelector('.mobile-contact-info');

  if(mainNav){
    if(!mobileContact){mobileContact=document.createElement('div');mobileContact.className='mobile-contact-info';mainNav.appendChild(mobileContact)}
    mobileContact.innerHTML='<a class="mobile-location" href="https://www.google.com/maps/search/?api=1&query=420+Des+Meurons+St%2C+Winnipeg%2C+MB+R2H+2N9" target="_blank" rel="noopener">420 DES MEURONS ST, WINNIPEG</a><a class="mobile-phone" href="tel:+12049634462">204-963-4462</a><span class="mobile-hours">MON–SAT: 10 AM–6 PM</span>';
  }

  if(nav){
    nav.innerHTML=`<div class="finance-dropdown"><button type="button" class="finance-dropdown-toggle" aria-expanded="false">Inventory</button><div class="finance-dropdown-menu"><a href="inventory.html">Browse Inventory</a><a href="vehicle-sourcing.html">Find a Vehicle for Me</a></div></div><div class="finance-dropdown"><button type="button" class="finance-dropdown-toggle" aria-expanded="false">Financing</button><div class="finance-dropdown-menu"><a href="pre-approval.html">Get Pre-Approved</a><a href="payment-estimator.html">Payment Estimator</a></div></div><a href="warranty.html">Warranty</a><div class="finance-dropdown"><button type="button" class="finance-dropdown-toggle" aria-expanded="false">Trade-In</button><div class="finance-dropdown-menu"><a href="trade-in.html?intent=trade">Trade In Your Vehicle</a><a href="trade-in.html?intent=sell">Sell Your Vehicle</a><a href="trade-in.html?intent=consign">Consign Your Vehicle</a></div></div><a href="service-repairs.html">Services &amp; Repairs</a><a href="index.html#contact">Contact</a><a class="nav-cta" href="book-test-drive.html">Book a Test Drive</a>`;
    nav.addEventListener('click',event=>{const link=event.target.closest('a[href*="trade-in.html?intent="]');if(!link)return;event.preventDefault();event.stopImmediatePropagation();location.assign(link.href)},true);
  }

  if(menuBtn&&nav){
    menuBtn.addEventListener('click',()=>{
      const open=nav.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded',String(open));
      menuBtn.setAttribute('aria-label',open?'Close navigation':'Open navigation');
    });

    nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{
      nav.classList.remove('open');
      menuBtn.setAttribute('aria-expanded','false');
      menuBtn.setAttribute('aria-label','Open navigation');
    }));
  }

  document.querySelectorAll('.finance-dropdown-toggle').forEach(button=>button.addEventListener('click',()=>{
    const menu=button.closest('.finance-dropdown');
    const open=menu?.classList.toggle('open')||false;
    button.setAttribute('aria-expanded',String(open));
  }));

  const style=document.createElement('style');
  style.textContent=`
    @media(max-width:560px){
      .site-header .main-nav{
        position:relative!important;
        z-index:50!important;
      }
      .site-header .menu-btn{
        display:block!important;
        position:relative!important;
        z-index:201!important;
        cursor:pointer!important;
        pointer-events:auto!important;
      }
      .site-header #nav.page-nav{
        display:none!important;
        position:absolute!important;
        left:0!important;
        right:0!important;
        top:100%!important;
        z-index:200!important;
        width:100%!important;
        margin:0!important;
        background:#090a0d!important;
        padding:22px 7%!important;
        flex-direction:column!important;
        align-items:flex-start!important;
        gap:18px!important;
        box-shadow:0 12px 24px rgba(0,0,0,.35)!important;
      }
      .site-header #nav.page-nav.open{
        display:flex!important;
      }
      .site-header #nav.page-nav.open a,
      .site-header #nav.page-nav.open .finance-dropdown-toggle{
        color:#fff!important;
      }
      .site-header #nav.page-nav.open .nav-cta{
        width:100%!important;
        text-align:center!important;
      }
      .site-header .finance-dropdown-menu{
        position:static!important;
        display:none!important;
      }
      .site-header .finance-dropdown.open .finance-dropdown-menu{
        display:flex!important;
        flex-direction:column!important;
        gap:10px!important;
        padding:10px 0 0 14px!important;
      }
      .site-header .mobile-contact-info{
        overflow:visible!important;
      }
      .site-header #nav.page-nav.open .finance-dropdown{width:100%!important}
    }
  `;
  document.head.appendChild(style);
})();
