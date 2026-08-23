/* Emergency vehicle loader: independently loads the vehicle if the main page loader stalls. */
(() => {
  const URL = "https://dpsgtliddmdvfwjahkkq.supabase.co";
  const KEY = "sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0";
  const root = document.getElementById("vehicleDetail");
  const id = new URLSearchParams(location.search).get("id");
  const esc = v => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  const money = v => Number.isFinite(Number(v)) ? new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD",maximumFractionDigits:0}).format(Number(v)) : "$—";

  async function fetchVehicle() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`${URL}/rest/v1/Vehicles?select=*&id=eq.${encodeURIComponent(id)}`, {
        headers:{apikey:KEY,Authorization:`Bearer ${KEY}`}, signal:controller.signal
      });
      if (!response.ok) throw new Error(`Vehicle request failed: ${response.status}`);
      return response.json();
    } finally { clearTimeout(timer); }
  }

  async function recover() {
    if (!root || !id || !/Loading vehicle/i.test(root.textContent)) return;
    try {
      const rows = await fetchVehicle();
      const v = rows[0];
      if (!v) throw new Error("Vehicle not found");
      const title = `${v.Year||""} ${v.Make||""} ${v.Model||""}`.trim();
      document.title = `${title} | M.O Motors`;
      const fields=[["Year",v.Year],["Make",v.Make],["Model",v.Model],["Trim",v.Trim],["Odometer",v.Mileage?`${Number(v.Mileage).toLocaleString("en-CA")} km`:null],["Body Style",v.BodyStyle],["Transmission",v.Transmission],["Engine Cylinders",v.EngineCylinders],["Engine Size",v.EngineSize],["Drivetrain",v.Drivetrain],["Exterior Colour",v.ExteriorColor],["Interior Colour",v.InteriorColor],["Doors",v.Doors],["Fuel Type",v.FuelType],["Passengers",v.Passengers],["VIN",v.VIN]].filter(([,x])=>x!==null&&x!==undefined&&x!=="");
      const sold=String(v.Status||"").toLowerCase()==="sold";
      root.innerHTML=`<div class="vehicle-detail-grid"><section class="detail-gallery"><div class="detail-main-image placeholder"><span>PHOTO COMING SOON</span></div></section><section class="detail-info"><p class="detail-year">${sold?"SOLD":"PRE-OWNED"}</p><h1 class="detail-title">${esc(title)}</h1><div class="detail-meta"><span>${v.Mileage?Number(v.Mileage).toLocaleString("en-CA"):"—"} km</span><span>${esc(v.Transmission||"Automatic")}</span></div><div class="detail-price"><strong>${money(v.Price)}</strong></div>${sold?"":`<div class="vehicle-action-stack"><div class="primary-action-row"><a class="btn btn-primary" href="book-test-drive.html?vehicle=${encodeURIComponent(v.id)}">Book a Test Drive</a><a class="btn detail-outline" href="pre-approval.html?vehicle=${encodeURIComponent(v.id)}">Get Pre-Approved</a></div></div>`}<div class="detail-description"><h2>Vehicle Details</h2><p>${esc(v.Description||"Contact M.O Motors for complete vehicle details, features and availability.").replaceAll("\n","<br>")}</p></div><div class="spec-grid">${fields.map(([l,x])=>`<div><span>${esc(l)}</span><b>${esc(x)}</b></div>`).join("")}</div></section></div>`;
    } catch (error) {
      console.error("Emergency vehicle loader failed",error);
      if (/Loading vehicle/i.test(root.textContent)) root.innerHTML='<div class="inventory-empty">We could not load this vehicle right now. Please try again.</div>';
    }
  }
  setTimeout(recover,1000);
})();
