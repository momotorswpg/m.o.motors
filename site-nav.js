(()=>{
  document.querySelectorAll('.brand-tagline').forEach(tagline=>{tagline.textContent='CERTIFIED PRE-OWNED VEHICLES'});
  document.querySelectorAll('.hero-line .accent').forEach(accent=>{accent.textContent=accent.textContent.replace(/\./g,'')});

  const nav=document.getElementById('nav');
  const menuBtn=document.getElementById('menuBtn');

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
    }
  `;
  document.head.appendChild(style);
})();