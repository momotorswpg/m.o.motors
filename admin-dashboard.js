(() => {
  const $ = id => document.getElementById(id);
  const salesPages = ["dashboard", "inventory", "bookings", "consents", "tradeins", "billsale", "timesheet"];
  const adminPages = ["requests", "employees", "payroll", "finance"];
  let pages = salesPages;
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
    const consents = document.querySelector(".test-drive-consent-panel");
    const tradeins = document.querySelector(".tradeins-panel");
    const requests = ensurePanel("requests-panel", '<div class="panel-head"><div><span class="eyebrow">CUSTOMER REQUESTS</span><h3>Website leads</h3><p class="muted">Active requests appear first. Completed and cancelled requests stay out of the way until you choose to view them.</p></div><button id="refreshRequestsBtn" class="secondary-btn" type="button">Refresh Requests</button></div><div id="requestFilters" class="request-toolbar"><label><span>Request type</span><select id="requestTypeFilter"><option value="all">All request types</option><option value="warranty">Warranty</option><option value="vehicle_sourcing">Vehicle Sourcing</option><option value="service_repair">Service & Repair</option><option value="vehicle_disposition">Sell / Trade / Consign</option><option value="referral">Referral</option></select></label><label><span>Show</span><select id="requestStatusFilter"><option value="active">Active requests</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="all">All requests</option></select></label></div><div id="requestsList" class="requests-list"><div class="muted">Loading customer requests…</div></div>');
    const billsale = document.querySelector(".bill-of-sale-panel");
    const finance = document.querySelector(".finance-panel");
    const employees = document.querySelector(".employees-panel");
    const timesheet = document.querySelector(".timesheet-panel");
    const payroll = document.querySelector(".payroll-panel");
    const isAdmin = ["owner", "admin"].includes(window.moStaff?.role);
    pages = isAdmin ? [...salesPages, ...adminPages] : [...salesPages];

    const dashboard = document.createElement("section");
    dashboard.className = "admin-page dashboard-page";
    dashboard.innerHTML = '<div class="dashboard-hero"><span class="eyebrow">DASHBOARD</span><h3>Dealership overview</h3><p class="muted">A quick summary of your dealership.</p></div><div class="dashboard-stats"><div class="stat-card"><span>Available</span><strong id="dashAvailable">0</strong></div><div class="stat-card"><span>Sold</span><strong id="dashSold">0</strong></div><div class="stat-card"><span>Inventory value</span><strong id="dashValue">$0</strong></div></div><section class="panel"><div class="panel-head"><div><span class="eyebrow">TEST DRIVES</span><h3>Booking summary</h3></div><button id="viewBookingsFromDash" class="secondary-btn" type="button">View all bookings</button></div><div id="dashBookingSummary" class="bookings-list"></div></section>';
    top?.after(dashboard);

    const nav = document.createElement("nav");
    nav.className = "admin-page-nav";
    const label = page => page === "tradeins" ? "Trade-Ins" : page === "billsale" ? "Bill of Sale" : page === "consents" ? "Test Drive Consent" : page === "requests" ? "Website Leads" : page === "finance" ? "Payment Defaults" : page[0].toUpperCase() + page.slice(1);
    nav.innerHTML = `<div class="admin-nav-group"><span>SALES</span>${salesPages.map(page => `<button type="button" data-page="${page}">${label(page)}</button>`).join("")}</div>${isAdmin ? `<div class="admin-nav-group"><span>ADMIN</span>${adminPages.map(page => `<button type="button" data-page="${page}">${label(page)}</button>`).join("")}<a class="admin-nav-link" href="finance-admin-login.html">Finance Applications ↗</a></div>` : ""}`;
    top?.after(nav);

    const targets = {inventory:[stats,grid,inventory],bookings:[bookings],consents:[consents],tradeins:[tradeins],requests:[requests],billsale:[billsale],finance:[finance],employees:[employees],timesheet:[timesheet],payroll:[payroll]};
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
      if (page === "consents") { window.dispatchEvent(new Event("resize")); window.loadTestDriveConsents?.(); }
      if (page === "tradeins") window.loadTradeins?.();
      if (page === "requests") window.loadCustomerRequests?.();
      if (page === "billsale") window.loadBillOfSaleVehicles?.();
      if (page === "finance") window.loadFinanceSettings?.();
      if (page === "employees") window.loadEmployeeAdmin?.();
      if (page === "timesheet") window.loadEmployeeTimesheet?.();
      if (page === "payroll") window.loadPayrollAdmin?.();
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
