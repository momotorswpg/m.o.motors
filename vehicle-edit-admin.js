(() => {
  const db = window.__moAdminDb;
  if (!db) return;
  const list = document.getElementById("inventoryList");
  if (!list) return;

  const fields = [
    ["VIN","VIN","vin"],["Year","Year","number"],["Make","Make","text"],["Model","Model","text"],["Trim","Trim","text"],
    ["Mileage","Mileage (km)","number"],["Price","Price (CAD)","number"],["Status","Status","select:Available,Sold,Pending,Hold"],
    ["Transmission","Transmission","customselect:Automatic,Manual,CVT,Automated Manual"],["BodyStyle","Body Style","text"],["EngineCylinders","Engine Cylinders","number"],["EngineSize","Engine Size","engine"],
    ["Drivetrain","Drivetrain","text"],["ExteriorColor","Exterior Colour","customselect:Black,White,Silver,Grey,Red,Blue,Brown,Beige,Tan,Green,Orange,Yellow,Gold,Maroon,Purple,Bronze"],["InteriorColor","Interior Colour","customselect:Black,Grey,Beige,Brown,Tan,White,Red,Blue,Burgundy"],
    ["Doors","Doors","number"],["FuelType","Fuel Type","text"],["Passengers","Passengers","number"],["AdditionalInfo","Features / Additional Information","textarea"],["Description","Description","textarea"],["CarfaxURL","CARFAX URL","url"]
  ];

  function esc(v="") { return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
  function input(field, label, type, value) {
    if (type === "vin") return `<label class="edit-wide edit-vin-label">${label}<span class="edit-vin-row"><input name="${field}" type="text" minlength="17" maxlength="17" value="${esc(value ?? "")}"><button class="secondary-btn" type="button" data-edit-vin-lookup>Lookup VIN</button></span><small class="edit-vin-status" role="status"></small></label>`;
    if (type === "textarea") return `<label class="edit-wide">${label}<textarea name="${field}" rows="5" placeholder="Add features, options, condition notes or other vehicle details not covered above.">${esc(value || "")}</textarea></label>`;
    if (type.startsWith("select:")) {
      const options = type.slice(7).split(",").map(x => `<option value="${x}" ${String(value||"Available")===x?"selected":""}>${x}</option>`).join("");
      return `<label>${label}<select name="${field}">${options}</select></label>`;
    }
    if (type.startsWith("customselect:")) {
      const options = type.slice(13).split(",");
      const known = options.includes(String(value));
      return `<label>${label}<select name="${field}"><option value="">Select ${label.toLowerCase()}</option>${options.map(x => `<option value="${x}" ${String(value)===x?"selected":""}>${x}</option>`).join("")}<option value="Other" ${value&&!known?"selected":""}>Other</option></select><input class="edit-custom-value ${value&&!known?"":"hidden"}" name="${field}Custom" value="${value&&!known?esc(value):""}" placeholder="Enter custom ${label.toLowerCase()}"></label>`;
    }
    if (type === "engine") return `<label>${label}<input name="${field}" type="text" inputmode="decimal" placeholder="e.g. 1.4L" value="${esc(value ?? "")}"></label>`;
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
    document.getElementById("editVehicleFields").addEventListener("change", event => {
      if (!event.target.matches("select")) return;
      const custom = event.target.closest("label")?.querySelector(".edit-custom-value");
      if (custom) custom.classList.toggle("hidden", event.target.value !== "Other");
    });
    document.getElementById("editVehicleForm").addEventListener("submit", save);
    document.getElementById("editVehicleForm").addEventListener("click", event => {
      if (event.target.closest("[data-edit-vin-lookup]")) lookupVin();
    });
    document.getElementById("editVehicleForm").addEventListener("keydown", event => {
      if (event.target.name === "VIN" && event.key === "Enter") { event.preventDefault(); lookupVin(); }
    });
  }

  function setDecodedField(form, name, value) {
    if (value == null || !String(value).trim()) return;
    const input = form.elements[name];
    if (!input) return;
    const cleaned = String(value).trim();
    if (input.tagName === "SELECT") {
      const matching = [...input.options].find(option => option.value.toLowerCase() === cleaned.toLowerCase());
      if (matching) input.value = matching.value;
      else if ([...input.options].some(option => option.value === "Other")) {
        input.value = "Other";
        const custom = form.elements[name + "Custom"];
        if (custom) { custom.value = cleaned; custom.classList.remove("hidden"); }
      }
      return;
    }
    input.value = name === "EngineSize" && /^\d+(?:\.\d+)?$/.test(cleaned) ? `${cleaned}L` : cleaned;
  }

  async function lookupVin() {
    const form = document.getElementById("editVehicleForm"),vin = form?.elements.VIN,button = form?.querySelector("[data-edit-vin-lookup]"),status = form?.querySelector(".edit-vin-status");
    if (!vin || !button || !status) return;
    const value = vin.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    vin.value = value;
    if (value.length !== 17) { status.textContent = "Enter a valid 17-character VIN."; return; }
    button.disabled = true;
    status.textContent = "Looking up vehicle…";
    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(value)}?format=json`);
      if (!response.ok) throw new Error("VIN lookup service is unavailable.");
      const vehicle = (await response.json()).Results?.[0];
      if (!vehicle) throw new Error("No vehicle information was returned.");
      const decoded = {Year:vehicle.ModelYear,Make:vehicle.Make,Model:vehicle.Model,Trim:vehicle.Trim,BodyStyle:vehicle.BodyClass,Transmission:vehicle.TransmissionStyle||vehicle.TransmissionSpeeds,Drivetrain:vehicle.DriveType,EngineCylinders:vehicle.EngineCylinders,EngineSize:vehicle.DisplacementL,FuelType:vehicle.FuelTypePrimary,Doors:vehicle.Doors,Passengers:vehicle.Seats};
      Object.entries(decoded).forEach(([name,fieldValue]) => setDecodedField(form,name,fieldValue));
      status.textContent = "Vehicle details filled in. Please verify the VIN data, then save your changes.";
    } catch (error) {
      console.error(error);
      status.textContent = `Could not look up this VIN: ${error.message}`;
    } finally { button.disabled = false; }
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
      if (t.startsWith("customselect:") && value === "Other") value = fd.get(f + "Custom")?.trim() || null;
      if (t === "number") value = value === "" ? null : Number(value);
      if (t === "engine" && value !== "") value = /^\d+(?:\.\d+)?$/i.test(value.trim()) ? `${value.trim()}L` : value.trim();
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
