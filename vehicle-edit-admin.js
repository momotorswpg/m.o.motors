(() => {
  const db = window.__moAdminDb;
  if (!db) return;
  const list = document.getElementById("inventoryList");
  if (!list) return;

  const fields = [
    ["VIN","VIN","text"],["Year","Year","number"],["Make","Make","text"],["Model","Model","text"],["Trim","Trim","text"],
    ["Mileage","Mileage (km)","number"],["Price","Price (CAD)","number"],["Status","Status","select:Available,Sold,Pending,Hold"],
    ["Transmission","Transmission","text"],["BodyStyle","Body Style","text"],["EngineCylinders","Engine Cylinders","text"],["EngineSize","Engine Size","text"],
    ["Drivetrain","Drivetrain","text"],["ExteriorColor","Exterior Colour","text"],["InteriorColor","Interior Colour","text"],
    ["Doors","Doors","text"],["FuelType","Fuel Type","text"],["Passengers","Passengers","text"],["Description","Additional Information / Features","textarea"],["CarfaxURL","CARFAX URL","url"]
  ];

  function esc(v="") { return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
  function input(field, label, type, value) {
    if (type === "textarea") return `<label class="edit-wide">${label}<textarea name="${field}" rows="5" placeholder="Add features, options, condition notes or other vehicle details not covered above.">${esc(value || "")}</textarea></label>`;
    if (type.startsWith("select:")) {
      const options = type.slice(7).split(",").map(x => `<option value="${x}" ${String(value||"Available")===x?"selected":""}>${x}</option>`).join("");
      return `<label>${label}<select name="${field}">${options}</select></label>`;
    }
    return `<label>${label}<input name="${field}" type="${type}" value="${esc(value ?? "")}"></label>`;
  }

  function ensureModal() {
    if (document.getElementById("vehicleEditModal")) return;
    const modal = document.createElement("div");
    modal.id = "vehicleEditModal";
    modal.className = "vehicle-edit-modal hidden";
    modal.innerHTML = `<div class="vehicle-edit-backdrop" data-close-edit></div><div class="vehicle-edit-dialog" role="dialog" aria-modal="true"><div class="vehicle-edit-head"><div><span class="eyebrow">EDIT VEHICLE</span><h3 id="editVehicleTitle">Vehicle</h3></div><button type="button" class="edit-close" data-close-edit>×</button></div><form id="editVehicleForm"><div id="editVehicleFields" class="edit-vehicle-grid"></div><label class="featured-check"><input type="checkbox" name="Featured"> <span><strong>Feature this vehicle on the homepage</strong><small>Turn this off to keep it in inventory but remove it from Featured Vehicles.</small></span></label><div class="edit-actions"><button type="button" class="secondary-btn" data-close-edit>Cancel</button><button type="submit" class="primary-btn">Save Changes</button><span id="editVehicleStatus" class="status"></span></div></form></div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-close-edit]").forEach(b => b.addEventListener("click", close));
    document.getElementById("editVehicleForm").addEventListener("submit", save);
  }

  let currentId = null;
  async function open(id) {
    ensureModal();
    const modal = document.getElementById("vehicleEditModal");
    const { data: v, error } = await db.from("Vehicles").select("*").eq("id", id).single();
    if (error) return alert("Could not load vehicle: " + error.message);
    currentId = v.id;
    document.getElementById("editVehicleTitle").textContent = `${v.Year || ""} ${v.Make || ""} ${v.Model || ""}`.trim();
    document.getElementById("editVehicleFields").innerHTML = fields.map(([f,l,t]) => input(f,l,t,v[f])).join("");
    document.querySelector('#editVehicleForm [name="Featured"]').checked = v.Featured === true;
    document.getElementById("editVehicleStatus").textContent = "";
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
  function close() { const m=document.getElementById("vehicleEditModal"); if(m)m.classList.add("hidden"); document.body.style.overflow=""; currentId=null; }

  async function save(e) {
    e.preventDefault();
    if (!currentId) return;
    const form = e.currentTarget;
    const status = document.getElementById("editVehicleStatus");
    const fd = new FormData(form);
    const row = { Featured: form.Featured.checked };
    fields.forEach(([f,,t]) => {
      let value = fd.get(f);
      if (t === "number") value = value === "" ? null : Number(value);
      row[f] = value === "" ? null : value;
    });
    status.textContent = "Saving…";
    const { error } = await db.from("Vehicles").update(row).eq("id", currentId);
    if (error) { status.textContent = error.message; return; }
    status.textContent = "Saved.";
    if (typeof window.loadAll === "function") await window.loadAll();
    else document.getElementById("refreshBtn")?.click();
    setTimeout(close, 450);
  }

  function addButtons() {
    list.querySelectorAll(".inventory-row").forEach(row => {
      if (row.querySelector("[data-edit-vehicle]")) return;
      const actions = row.querySelector(".row-actions");
      if (!actions) return;
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "mini-btn edit-vehicle-btn"; btn.dataset.editVehicle = row.dataset.id; btn.textContent = "Edit Vehicle";
      btn.addEventListener("click", () => open(row.dataset.id));
      actions.appendChild(btn);
    });
  }
  const observer = new MutationObserver(addButtons);
  observer.observe(list,{childList:true,subtree:true});
  addButtons();
})();
