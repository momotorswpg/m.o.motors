(() => {
  const $ = id => document.getElementById(id);
  const pages = ["dashboard", "inventory", "bookings", "tradeins", "requests", "billsale", "finance", "settings"];
  let initialized = false;

  function ensurePanel(className, html) {
    let panel = document.querySelector(`.${className}`);
    if (!panel) {
      panel = document.createElement("section");
      panel.className = `panel ${className}`;
      panel.innerHTML = html;
      $("adminView")?.appendChild(panel);
    }
    return panel;
  }

  function init() {
    const admin = $("adminView");
    if (!admin || initialized) return;
    initialized = true;
    const top = admin.querySelector(".topbar");
    const stats = admin.querySelector(".stats-row");
    const grid = admin.querySelector(".layout-grid");
    const inventory = admin.querySelector(".inventory-panel");
    const bookings = document.querySelector(".bookings-panel");
    const tradeins = document.querySelector(".tradeins-panel");
    const requests = ensurePanel("requests-panel", '<div class="panel-head"><div><span class="eyebrow">CUSTOMER REQUESTS</span><h3>Website leads</h3><p class="muted">Warranty, vehicle sourcing, service, vehicle sale and referral requests.</p></div><button id="refreshRequestsBtn" class="secondary-btn" type="button">Refresh Requests</button></div><div id="requestFilters" class="request-filters"><button type="button" data-request-filter="all" class="mini-btn active">All</button><button type="button" data-request-filter="warranty" class="mini-btn">Warranty</button><button type="button" data-request-filter="vehicle_sourcing" class="mini-btn">Sourcing</button><button type="button" data-request-filter="service_repair" class="mini-btn">Service</button><button type="button" data-request-filter="vehicle_disposition" class="mini-btn">Sell / Trade</button><button type="button" data-request-filter="referral" class="mini-btn">Referrals</button></div><div id="requestsList" class="requests-list"><div class="muted">Loading customer requests…</div></div>');
    const billsale = document.querySelector(".bill-of-sale-panel");
    const finance = document.querySelector(".finance-panel");
    const settings = ensurePanel("settings-panel", '<div class="panel-head"><div><span class="eyebrow">SETTINGS</span><h3>Dealership settings</h3><p class="muted">Manage dealership administration and website defaults.</p></div></div>');

    const dashboard = document.createElement("section");
    dashboard.className = "admin-page dashboard-page";
    dashboard.innerHTML = '<div class="dashboard-hero"><span class="eyebrow">DASHBOARD</span><h3>Dealership overview</h3><p class="muted">A quick summary of your dealership.</p></div><div class="dashboard-stats"><div class="stat-card"><span>Available</span><strong id="dashAvailable">0</strong></div><div class="stat-card"><span>Sold</span><strong id="dashSold">0</strong></div><div class="stat-card"><span>Inventory value</span><strong id="dashValue">$0</strong></div></div><section class="panel"><div class="panel-head"><div><span class="eyebrow">TEST DRIVES</span><h3>Booking summary</h3></div><button id="viewBookingsFromDash" class="secondary-btn" type="button">View all bookings</button></div><div id="dashBookingSummary" class="bookings-list"></div></section>';
    top?.after(dashboard);

    const nav = document.createElement("nav");
    nav.className = "admin-page-nav";
    nav.innerHTML = pages.map(page => `<button type="button" data-page="${page}">${page === "tradeins" ? "Trade-Ins" : page === "billsale" ? "Bill of Sale" : page[0].toUpperCase() + page.slice(1)}</button>`).join("");
    top?.after(nav);

    const targets = {inventory:[stats,grid,inventory],bookings:[bookings],tradeins:[tradeins],requests:[requests],billsale:[billsale],finance:[finance],settings:[settings]};
    function show(page) {
      if (!pages.includes(page)) page = "dashboard";
      dashboard.style.display = page === "dashboard" ? "block" : "none";
      Object.entries(targets).forEach(([name,elements]) => elements.forEach(element => {
        if (!element) return;
        if (name !== page) { element.style.display = "none"; return; }
        element.style.display = name === "inventory" && (element === stats || element === grid) ? "grid" : "block";
      }));
      nav.querySelectorAll("button").forEach(button => button.classList.toggle("active", button.dataset.page === page));
      if (page === "inventory") window.loadAll?.();
      if (page === "bookings") window.loadBookings?.();
      if (page === "tradeins") window.loadTradeins?.();
      if (page === "requests") window.loadCustomerRequests?.();
      if (page === "billsale") window.loadBillOfSaleVehicles?.();
      if (page === "finance") window.loadFinanceSettings?.();
      if (page === "dashboard") loadDashboard();
      if (location.hash.slice(1) !== page) location.hash = page;
    }

    nav.addEventListener("click", event => {
      const button = event.target.closest("[data-page]");
      if (button) show(button.dataset.page);
    });
    dashboard.querySelector("#viewBookingsFromDash")?.addEventListener("click", () => show("bookings"));
    window.addEventListener("hashchange", () => {
      const page = location.hash.slice(1);
      if (page && pages.includes(page) && !nav.querySelector(`[data-page="${page}"].active`)) show(page);
    });
    show(pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : "dashboard");
  }

  async function loadDashboard() {
    if (!$("adminView") || $("adminView").classList.contains("hidden")) return;
    try {
      const {data:vehicleRows,error:vehicleError} = await db.from("Vehicles").select("Status,Price");
      if (vehicleError) throw vehicleError;
      const rows = vehicleRows || [];
      const available = rows.filter(vehicle => String(vehicle.Status || "Available").toLowerCase() === "available");
      $("dashAvailable").textContent = available.length;
      $("dashSold").textContent = rows.filter(vehicle => String(vehicle.Status || "").toLowerCase() === "sold").length;
      $("dashValue").textContent = new Intl.NumberFormat("en-CA", {style:"currency",currency:"CAD",maximumFractionDigits:0}).format(available.reduce((total,vehicle) => total + (Number(vehicle.Price)||0), 0));

      const {data:bookingRows,error:bookingError} = await db.from("test_drive_bookings").select("preferred_date,status");
      if (bookingError) throw bookingError;
      const today = new Date();
      today.setHours(0,0,0,0);
      const groups = {};
      (bookingRows || []).forEach(booking => {
        if (String(booking.status || "").toLowerCase() === "cancelled") return;
        const date = String(booking.preferred_date || "").slice(0,10);
        if (!date) return;
        const bookingDate = new Date(`${date}T12:00:00`);
        bookingDate.setHours(0,0,0,0);
        if (bookingDate >= today) groups[date] = (groups[date] || 0) + 1;
      });
      $("dashBookingSummary").innerHTML = Object.entries(groups).sort((a,b) => a[0].localeCompare(b[0])).map(([date,count]) => `<div class="booking-card"><div class="booking-main"><h4>${new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</h4><div class="booking-details"><div><span>Bookings</span><strong>${count}</strong></div></div></div></div>`).join("") || '<div class="booking-empty">No current or upcoming bookings found.</div>';
    } catch (error) {
      console.error(error);
      if ($("dashBookingSummary")) $("dashBookingSummary").innerHTML = '<div class="booking-empty">Could not load dashboard summary.</div>';
    }
  }

  function start() {
    if ($("adminView") && !$("adminView").classList.contains("hidden")) init();
    else setTimeout(start, 100);
  }
  document.addEventListener("DOMContentLoaded", start);
})();
