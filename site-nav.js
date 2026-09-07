(()=>{
  const dealerAddress='Unit 104, 420 Des Meurons St, Winnipeg, MB R2H 2N9';
  const dealerMapUrl='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(dealerAddress);
  function syncDealerAddress(root=document){
    root.querySelectorAll?.('.mobile-location').forEach(link=>{link.textContent='UNIT 104, 420 DES MEURONS ST, WINNIPEG';link.href=dealerMapUrl});
    root.querySelectorAll?.('.test-drive-contact .contact-value').forEach(element=>{if(/420\s+Des\s+Meurons/i.test(element.textContent||''))element.textContent=dealerAddress});
    root.querySelectorAll?.('.contact-list a[href*="google.com/maps"]').forEach(link=>{link.href=dealerMapUrl;link.innerHTML='Unit 104, 420 Des Meurons St<br>Winnipeg, MB R2H 2N9'});
    root.querySelectorAll?.('iframe[title="M.O Motors location"]').forEach(frame=>{frame.src='https://www.google.com/maps?q='+encodeURIComponent(dealerAddress)+'&output=embed'});
  }
  syncDealerAddress();
  new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1)syncDealerAddress(node)}))).observe(document.body,{childList:true,subtree:true});

  document.querySelectorAll('.brand-wordmark').forEach(brand=>{
    brand.innerHTML='<span class="site-logo-crop"><img src="mo-motors-logo.png" alt="M.O Motors Certified Pre-Owned Vehicles"></span>';
  });
  document.querySelectorAll('.footer-wordmark').forEach(brand=>{
    brand.innerHTML='<span class="footer-logo-crop"><img src="mo-motors-logo.png" alt="M.O Motors Certified Pre-Owned Vehicles"></span>';
  });

  document.querySelectorAll('.brand-tagline').forEach(tagline=>{tagline.textContent='CERTIFIED PRE-OWNED VEHICLES'});
  document.querySelectorAll('.hero-line .accent').forEach(accent=>{accent.textContent=accent.textContent.replace(/\./g,'')});

  const nav=document.getElementById('nav');
  const menuBtn=document.getElementById('menuBtn');
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

  const mobileActionBar=document.createElement('nav');
  mobileActionBar.className='mobile-action-bar';
  mobileActionBar.setAttribute('aria-label','Quick contact actions');
  mobileActionBar.innerHTML=`
    <a href="tel:+12049634462" aria-label="Call M.O Motors">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6.6 3.7 9.1 3l2 4.1-2.1 1.7a15.3 15.3 0 0 0 6.2 6.2l1.7-2.1 4.1 2-.7 2.5a2.1 2.1 0 0 1-2.1 1.6C10.9 18.3 5.7 13.1 5 5.8a2.1 2.1 0 0 1 1.6-2.1Z"/></svg>
      <span>Call</span>
    </a>
    <a href="${dealerMapUrl}" target="_blank" rel="noopener" aria-label="Get directions to M.O Motors">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11A7 7 0 1 0 5 10c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>
      <span>Directions</span>
    </a>
    <a class="mobile-action-primary" href="book-test-drive.html" aria-label="Book a test drive">
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 5.5h14v14H5zM8 3v5M16 3v5M5 10h14"/></svg>
      <span>Book Test Drive</span>
    </a>`;
  document.body.appendChild(mobileActionBar);

  const style=document.createElement('style');
  style.textContent=`
    .mobile-action-bar{display:none}
    @media(max-width:560px){
      body{padding-bottom:calc(70px + env(safe-area-inset-bottom))}
      .mobile-action-bar{
        position:fixed;
        z-index:1000;
        right:0;
        bottom:0;
        left:0;
        display:grid;
        grid-template-columns:.8fr 1fr 1.55fr;
        min-height:64px;
        padding-bottom:env(safe-area-inset-bottom);
        border-top:1px solid #32343a;
        background:#111216;
        box-shadow:0 -8px 24px rgba(0,0,0,.2);
      }
      .mobile-action-bar a{
        display:flex;
        min-width:0;
        align-items:center;
        justify-content:center;
        gap:7px;
        padding:12px 6px;
        color:#fff;
        font-size:11px;
        font-weight:800;
        line-height:1.1;
        text-align:center;
        text-decoration:none;
        text-transform:uppercase;
        letter-spacing:.25px;
      }
      .mobile-action-bar a+a{border-left:1px solid #32343a}
      .mobile-action-bar svg{
        width:18px;
        height:18px;
        flex:0 0 auto;
        fill:none;
        stroke:currentColor;
        stroke-width:1.9;
        stroke-linecap:round;
        stroke-linejoin:round;
      }
      .mobile-action-bar .mobile-action-primary{
        border-left:0;
        background:#d71920;
      }
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
      .site-header #nav.page-nav.open .finance-dropdown{width:100%!important}
    }
  `;
  document.head.appendChild(style);
})();
