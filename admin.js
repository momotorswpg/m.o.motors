const SUPABASE_URL = "https://dpsgtliddmdvfwjahkkq.supabase.co";
const SUPABASE_KEY = "sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0";
const BUCKET = "vehicle-images";

const { createClient } = window.supabase;
// Keep one client for the whole admin page. Other admin scripts reuse this
// instance so Supabase does not register competing auth listeners.
const db = window.__moAdminDb || (window.__moAdminDb = createClient(SUPABASE_URL, SUPABASE_KEY));

const $ = (id) => document.getElementById(id);
const toast = (message) => {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
};
const money = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat("en-CA", {style:"currency", currency:"CAD", maximumFractionDigits:0}).format(Number(value)) : "$—";
const km = (value) => Number.isFinite(Number(value)) ? `${new Intl.NumberFormat("en-CA").format(Number(value))} km` : "Mileage N/A";
const esc = (value = "") => String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

let vehicles = [];
let selectedVehicleId = null;
let editingVehicleId = null;
let selectedImages = [];
let pendingVehicleFiles = [];
let pendingPreviewUrls = [];
let selectedPendingFiles = new Set();
let selectedSavedPhotoIds = new Set();
let activeAdminUserId = null;
let activeStaffMember = null;
let loadAllPromise = null;

async function requireSession() {
  const { data: { session } } = await db.auth.getSession();
  if (session) await showAdmin(session);
  else showAuth();
}

function showAuth() {
  activeAdminUserId = null;
  activeStaffMember = null;
  window.moStaff = null;
  delete document.body.dataset.staffRole;
  $("authView").classList.remove("hidden");
  $("adminView").classList.add("hidden");
  $("sessionEmail").textContent = "";
}

async function showAdmin(session) {
  const userId = session?.user?.id;
  const alreadyVisible = !$("adminView").classList.contains("hidden");
  if (alreadyVisible && activeAdminUserId === userId && activeStaffMember) return;
  const { data: member, error } = await db.from("staff_members").select("*").eq("user_id", userId).maybeSingle();
  if (error || !member || member.active === false) {
    console.error(error || new Error("No active staff membership"));
    await db.auth.signOut();
    showAuth();
    $("loginStatus").textContent = "This account does not have active staff access.";
    return;
  }
  activeStaffMember = member;
  window.moStaff = member;
  const isSales = member.role === "sales";
  document.body.dataset.staffRole = isSales ? "sales" : "admin";
  const snapshot = document.querySelector(".sidebar-snapshot");
  if (snapshot) snapshot.innerHTML = isSales
    ? '<span class="eyebrow">SALES WORKSPACE</span><div>Vehicle inventory</div><div>Customer bookings</div><div>Test drive consents</div><div>Trade-in requests</div><div>Bill of sale</div><div>My schedule and timesheet</div>'
    : '<span class="eyebrow">ADMIN WORKSPACE</span><div>All sales tools</div><div>Website requests</div><div>Employee accounts</div><div>Schedules, payroll and timesheets</div><div>Finance applications</div><div>Payment defaults</div>';
  $("authView").classList.add("hidden");
  $("adminView").classList.remove("hidden");
  $("sessionEmail").textContent = `${member.display_name} · ${member.role === "sales" ? "Sales" : "Admin"}`;
  activeAdminUserId = userId;
  window.dispatchEvent(new CustomEvent("mostaffready", { detail: member }));
  loadAll();
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = $("loginStatus");
  status.textContent = "Signing in…";
  const { data, error } = await db.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });
  if (error) {
    status.textContent = error.message;
    return;
  }
  status.textContent = "";
  await showAdmin(data.session);
});

$("forgotPasswordBtn").addEventListener("click", async () => {
  const status = $("loginStatus"), email = $("email").value.trim();
  if (!email) {
    status.textContent = "Enter your email address first.";
    $("email").focus();
    return;
  }
  status.textContent = "Sending password reset…";
  const redirectTo = `${location.origin}/admin-reset-password.html`;
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
  status.textContent = error ? error.message : "Check your email for a secure password-reset link.";
});

const formValue = id => $(id)?.value?.trim() || "";
const optionalNumber = id => formValue(id) === "" ? null : Number(formValue(id));
const engineSizeValue = value => {
  const cleaned = String(value || "").trim();
  if (!cleaned) return null;
  return /^\d+(?:\.\d+)?$/i.test(cleaned) ? `${cleaned}L` : cleaned;
};
const customSelectValue = (id, customId) => formValue(id) === "Other" ? (formValue(customId) || null) : (formValue(id) || null);

[["transmission", "transmissionCustom"], ["exteriorColor", "exteriorColorCustom"], ["interiorColor", "interiorColorCustom"]].forEach(([selectId, customId]) => {
  $(selectId)?.addEventListener("change", () => $(customId)?.classList.toggle("hidden", formValue(selectId) !== "Other"));
});

$("signOutBtn").addEventListener("click", async () => {
  await db.auth.signOut();
  selectedVehicleId = null;
  location.reload();
});

db.auth.onAuthStateChange((_event, session) => {
  if (session) setTimeout(() => showAdmin(session), 0);
  else showAuth();
});

$("vehicleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = $("vehicleStatus");
  status.textContent = "Saving vehicle…";

  const row = {
    VIN: formValue("vin"),
    Year: optionalNumber("year"),
    Make: MOMotorsVehicleData.make(formValue("make")),
    Model: MOMotorsVehicleData.model(formValue("model")),
    Trim: formValue("trim") || null,
    Mileage: optionalNumber("mileage"),
    Price: optionalNumber("price"),
    Status: formValue("status"),
    Transmission: customSelectValue("transmission", "transmissionCustom"),
    BodyStyle: MOMotorsVehicleData.body(formValue("bodyStyle")) || null,
    EngineCylinders: optionalNumber("engineCylinders"),
    EngineSize: engineSizeValue(formValue("engineSize")),
    Drivetrain: MOMotorsVehicleData.drivetrain(formValue("drivetrain")) || null,
    ExteriorColor: customSelectValue("exteriorColor", "exteriorColorCustom"),
    InteriorColor: customSelectValue("interiorColor", "interiorColorCustom"),
    Doors: optionalNumber("doors"),
    FuelType: MOMotorsVehicleData.fuel(formValue("fuelType")) || null,
    Passengers: optionalNumber("passengers"),
    AdditionalInfo: formValue("additionalInfo") || null,
    Description: formValue("description") || null,
    CarfaxURL: formValue("carfaxUrl") || null
  };

  if (editingVehicleId) {
    const vehicleId = editingVehicleId;
    const { data, error } = await db.from("Vehicles").update(row).eq("id", vehicleId).select().single();
    if (error) {
      console.error(error);
      status.textContent = error.message;
      return;
    }
    status.textContent = "Vehicle details saved.";
    toast("Vehicle and photo changes saved.");
    await loadAll();
    selectVehicle(data.id);
    return;
  }

  const { data, error } = await db.from("Vehicles").insert(row).select().single();
  if (error) {
    console.error(error);
    status.textContent = error.message;
    return;
  }

  status.textContent = "Vehicle added.";
  toast("Vehicle added successfully.");
  selectedVehicleId = data.id;
  const queuedFiles = [...pendingVehicleFiles];
  pendingVehicleFiles = [];
  clearPendingPreviewUrls();
  if (queuedFiles.length) {
    status.textContent = `Vehicle added. Uploading ${queuedFiles.length} photo${queuedFiles.length === 1 ? "" : "s"}…`;
    const uploaded = await uploadVehicleFiles(queuedFiles);
    status.textContent = uploaded ? `Vehicle and ${queuedFiles.length} photo${queuedFiles.length === 1 ? "" : "s"} added.` : "Vehicle added, but one or more photos could not be uploaded.";
  } else {
    await loadAll();
    selectVehicle(data.id);
  }
  $("vehicleForm").reset();
  $("status").value = "Available";
  ["transmissionCustom", "exteriorColorCustom", "interiorColorCustom"].forEach(id => $(id)?.classList.add("hidden"));
});

$("resetFormBtn").addEventListener("click", () => {
  if (editingVehicleId) {
    const vehicle = vehicles.find(item => String(item.id) === String(editingVehicleId));
    if (vehicle) populateVehicleForm(vehicle);
    $("vehicleStatus").textContent = "";
    $("vinLookupStatus").textContent = "";
    return;
  }
  $("vehicleForm").reset();
  $("status").value = "Available";
  $("vehicleStatus").textContent = "";
  $("vinLookupStatus").textContent = "";
  pendingVehicleFiles = [];
  clearPendingPreviewUrls();
  if (!selectedVehicleId) renderPendingPhotos();
  ["transmissionCustom", "exteriorColorCustom", "interiorColorCustom"].forEach(id => $(id)?.classList.add("hidden"));
});

const vehicleWorkflowModal = $("vehicleWorkflowModal");

function setVehicleFormSelect(selectId, customId, value) {
  const select = $(selectId);
  if (!select) return;
  const normalized = String(value || "");
  const match = [...select.options].find(option => option.value.toLowerCase() === normalized.toLowerCase());
  if (match) {
    select.value = match.value;
    if (customId) { $(customId).value = ""; $(customId).classList.add("hidden"); }
  } else if (customId && normalized) {
    select.value = "Other";
    $(customId).value = normalized;
    $(customId).classList.remove("hidden");
  } else select.value = "";
}

function populateVehicleForm(vehicle) {
  const values = {
    vin: vehicle.VIN, year: vehicle.Year, make: vehicle.Make, model: vehicle.Model, trim: vehicle.Trim,
    mileage: vehicle.Mileage, price: vehicle.Price, bodyStyle: vehicle.BodyStyle, engineCylinders: vehicle.EngineCylinders,
    engineSize: vehicle.EngineSize, drivetrain: vehicle.Drivetrain, doors: vehicle.Doors, fuelType: vehicle.FuelType,
    passengers: vehicle.Passengers, additionalInfo: vehicle.AdditionalInfo, description: vehicle.Description, carfaxUrl: vehicle.CarfaxURL
  };
  Object.entries(values).forEach(([id, value]) => { if ($(id)) $(id).value = value ?? ""; });
  $("status").value = String(vehicle.Status || "Available").toLowerCase() === "pending" ? "Coming Soon" : (vehicle.Status || "Available");
  setVehicleFormSelect("transmission", "transmissionCustom", vehicle.Transmission);
  setVehicleFormSelect("exteriorColor", "exteriorColorCustom", vehicle.ExteriorColor);
  setVehicleFormSelect("interiorColor", "interiorColorCustom", vehicle.InteriorColor);
}

function configureVehicleWorkflow(mode, vehicle = null) {
  const editing = mode === "edit";
  $("vehicleWorkflowTitle").textContent = editing ? "Edit vehicle and photos" : "Add vehicle and photos";
  $("vehicleWorkflowDescription").textContent = editing
    ? "Update the vehicle details, upload or reorder photos, then save your changes in one place."
    : "Enter the vehicle details and choose its photos, then click Add Vehicle once to save everything together.";
  $("vehicleFormEyebrow").textContent = editing ? "EDIT VEHICLE" : "ADD VEHICLE";
  $("vehicleFormHeading").textContent = editing ? `${vehicle?.Year || ""} ${vehicle?.Make || ""} ${vehicle?.Model || ""}`.trim() : "Add a vehicle";
  $("vehicleFormSubmit").textContent = editing ? "Save Changes" : "Add Vehicle";
  $("resetFormBtn").textContent = editing ? "Reset Changes" : "Clear";
}

function clearVehiclePhotoSelection() {
  selectedVehicleId = null;
  pendingVehicleFiles = [];
  selectedPendingFiles.clear();
  selectedSavedPhotoIds.clear();
  clearPendingPreviewUrls();
  $("selectedVehicleLabel").textContent = "None";
  $("uploadHint").textContent = "Choose photos now. They will upload automatically when you click Add Vehicle.";
  $("photoInput").disabled = false;
  $("photoInput").value = "";
  renderPendingPhotos();
}

function openVehicleWorkflow(mode = "add", vehicleId = null) {
  if (mode === "add") {
    editingVehicleId = null;
    configureVehicleWorkflow("add");
    $("resetFormBtn").click();
    clearVehiclePhotoSelection();
  } else if (mode === "edit") {
    const vehicle = vehicles.find(item => String(item.id) === String(vehicleId));
    if (!vehicle) return toast("Could not find that vehicle.");
    editingVehicleId = vehicle.id;
    selectVehicle(vehicle.id);
    configureVehicleWorkflow("edit", vehicle);
    populateVehicleForm(vehicle);
    $("vehicleStatus").textContent = "";
    $("vinLookupStatus").textContent = "";
  }
  vehicleWorkflowModal.classList.remove("hidden");
  document.body.classList.add("inventory-modal-open");
  requestAnimationFrame(() => {
    $("vin").focus();
  });
}

function closeVehicleWorkflow() {
  vehicleWorkflowModal.classList.add("hidden");
  document.body.classList.remove("inventory-modal-open");
  $("openVehicleModalBtn").focus();
}

$("openVehicleModalBtn").addEventListener("click", () => openVehicleWorkflow("add"));
$("closeVehicleModalBtn").addEventListener("click", closeVehicleWorkflow);
vehicleWorkflowModal.addEventListener("click", event => {
  if (event.target === vehicleWorkflowModal) closeVehicleWorkflow();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !vehicleWorkflowModal.classList.contains("hidden")) closeVehicleWorkflow();
});

$("refreshBtn").addEventListener("click", loadAll);
$("inventorySearch").addEventListener("input", renderInventory);

const dropZone = $("dropZone");
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (!selectedVehicleId) queueVehicleFiles([...e.dataTransfer.files]);
  else uploadVehicleFiles([...e.dataTransfer.files]);
});
$("photoInput").addEventListener("change", (e) => {
  if (!selectedVehicleId) queueVehicleFiles([...e.target.files]);
  else uploadVehicleFiles([...e.target.files]);
});

function clearPendingPreviewUrls() {
  pendingPreviewUrls.forEach(url => URL.revokeObjectURL(url));
  pendingPreviewUrls = [];
}

function validImageFiles(files) {
  return files.filter(file => file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(file.name));
}

function queueVehicleFiles(files) {
  const valid = validImageFiles(files);
  if (!valid.length) return toast("Please select image files.");
  pendingVehicleFiles.push(...valid);
  $("photoInput").value = "";
  renderPendingPhotos();
}

function updatePhotoSelectionControls(total, selectedCount) {
  const actions = $("photoSelectionActions");
  const selectAll = $("selectAllPhotos");
  const remove = $("removeSelectedPhotos");
  actions.classList.toggle("hidden", total === 0);
  selectAll.checked = total > 0 && selectedCount === total;
  selectAll.indeterminate = selectedCount > 0 && selectedCount < total;
  remove.disabled = selectedCount === 0;
  remove.textContent = selectedCount ? `Remove selected (${selectedCount})` : "Remove selected";
}

function bindPhotoCardDrag(grid, selector, onReorder) {
  let dragged = null;
  grid.querySelectorAll(selector).forEach(card => {
    card.addEventListener("dragstart", event => {
      if (event.target.closest("button,input,label")) {
        event.preventDefault();
        return;
      }
      dragged = card;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.photoId || card.dataset.pendingIndex || "photo");
    });
    card.addEventListener("dragover", event => {
      event.preventDefault();
      if (!dragged || dragged === card) return;
      const rect = card.getBoundingClientRect();
      const sameRow = event.clientY >= rect.top && event.clientY <= rect.bottom;
      const before = sameRow ? event.clientX < rect.left + rect.width / 2 : event.clientY < rect.top + rect.height / 2;
      grid.insertBefore(dragged, before ? card : card.nextElementSibling);
      grid.querySelectorAll(".drag-target").forEach(item => item.classList.remove("drag-target"));
      card.classList.add("drag-target");
    });
    card.addEventListener("dragend", async () => {
      if (!dragged) return;
      dragged.classList.remove("dragging");
      grid.querySelectorAll(".drag-target").forEach(item => item.classList.remove("drag-target"));
      const order = [...grid.querySelectorAll(selector)].map(item => item.dataset.photoId ?? item.dataset.pendingIndex);
      dragged = null;
      await onReorder(order);
    });
  });
}

function renderPendingPhotos() {
  const grid = $("photoGrid");
  clearPendingPreviewUrls();
  if (!pendingVehicleFiles.length) {
    grid.className = "photo-grid empty-grid";
    grid.textContent = "Choose photos to include with this vehicle.";
    $("photoHelp").textContent = "No photos selected";
    selectedPendingFiles.clear();
    updatePhotoSelectionControls(0, 0);
    return;
  }
  selectedPendingFiles = new Set([...selectedPendingFiles].filter(file => pendingVehicleFiles.includes(file)));
  pendingPreviewUrls = pendingVehicleFiles.map(file => URL.createObjectURL(file));
  $("photoHelp").textContent = `${pendingVehicleFiles.length} photo${pendingVehicleFiles.length === 1 ? "" : "s"} ready to upload`;
  grid.className = "photo-grid";
  grid.innerHTML = pendingVehicleFiles.map((file, index) => `<div class="photo-card pending-photo-card ${selectedPendingFiles.has(file) ? "selected" : ""}" draggable="true" data-pending-index="${index}">
    <input class="photo-select" type="checkbox" data-select-pending-photo="${index}" aria-label="Select photo ${index + 1}" ${selectedPendingFiles.has(file) ? "checked" : ""}>
    <div class="photo-drag-handle" title="Drag to reorder" aria-label="Drag to reorder photo">☷</div>
    <img src="${pendingPreviewUrls[index]}" alt="Selected vehicle photo ${index + 1}">
    <div class="photo-info"><${index === 0 ? "strong" : "span"}>${index === 0 ? "Primary photo" : `Photo ${index + 1}`}</${index === 0 ? "strong" : "span"}><button class="mini-btn danger" type="button" data-remove-pending-photo="${index}">Remove</button></div>
  </div>`).join("");
  grid.querySelectorAll("[data-remove-pending-photo]").forEach(button => button.addEventListener("click", () => {
    const [removed] = pendingVehicleFiles.splice(Number(button.dataset.removePendingPhoto), 1);
    selectedPendingFiles.delete(removed);
    renderPendingPhotos();
  }));
  grid.querySelectorAll("[data-select-pending-photo]").forEach(input => input.addEventListener("change", () => {
    const file = pendingVehicleFiles[Number(input.dataset.selectPendingPhoto)];
    if (input.checked) selectedPendingFiles.add(file); else selectedPendingFiles.delete(file);
    input.closest(".photo-card").classList.toggle("selected", input.checked);
    updatePhotoSelectionControls(pendingVehicleFiles.length, selectedPendingFiles.size);
  }));
  bindPhotoCardDrag(grid, ".pending-photo-card", order => {
    const current = [...pendingVehicleFiles];
    pendingVehicleFiles = order.map(index => current[Number(index)]).filter(Boolean);
    renderPendingPhotos();
  });
  updatePhotoSelectionControls(pendingVehicleFiles.length, selectedPendingFiles.size);
}

function loadAll() {
  if (loadAllPromise) return loadAllPromise;

  loadAllPromise = (async () => {
    try {
    const { data, error } = await db.from("Vehicles").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    vehicles = data || [];
    $("availableCount").textContent = vehicles.filter(v => ["available", "coming soon", "pending"].includes(String(v.Status || "Available").toLowerCase())).length;
    await loadAllPhotos();
    renderInventory();
    if (selectedVehicleId) selectVehicle(selectedVehicleId);
    } catch (error) {
      console.error(error);
      toast("Could not load inventory: " + error.message);
    }
  })().finally(() => {
    loadAllPromise = null;
  });

  return loadAllPromise;
}

async function loadAllPhotos() {
  const { data, error } = await db.from("vehicle_images").select("*").order("sort_order", { ascending: true });
  if (error) {
    console.error(error);
    selectedImages = [];
    $("photoCount").textContent = "—";
    return;
  }
  window.allPhotos = data || [];
  $("photoCount").textContent = window.allPhotos.length;
}

function renderInventory() {
  const list = $("inventoryList");
  const query = $("inventorySearch").value.trim().toLowerCase();
  const filtered = vehicles.filter(v => [v.VIN, v.Make, v.Model].some(x => String(x || "").toLowerCase().includes(query)));
  if (!filtered.length) {
    list.innerHTML = `<div class="muted">No vehicles found.</div>`;
    return;
  }
  const renderRow = v => {
    const storedStatus = String(v.Status || "Available");
    const status = storedStatus.toLowerCase() === "pending" ? "Coming Soon" : storedStatus;
    const photos = (window.allPhotos || []).filter(p => String(p.vehicle_id) === String(v.id));
    const photoCount = photos.length;
    const primaryPhoto = photos.find(photo => photo.is_primary) || photos.slice().sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))[0];
    const statusOptions = ["Available", "Coming Soon", "Hold", "Sold"];
    if (!statusOptions.some(option => option.toLowerCase() === status.toLowerCase())) statusOptions.push(status);
    return `<div class="inventory-row" data-id="${esc(v.id)}">
      <div class="inventory-vehicle-cell">
        ${primaryPhoto?.image_url ? `<img class="inventory-thumb" src="${esc(primaryPhoto.image_url)}" alt="${esc(`${v.Year || ""} ${v.Make || ""} ${v.Model || ""}`.trim())}">` : `<div class="inventory-thumb inventory-thumb-placeholder" aria-hidden="true">No photo</div>`}
        <div>
          <div class="inventory-title"><a href="vehicle.html?id=${encodeURIComponent(v.id)}" target="_blank" rel="noopener" aria-label="Open ${esc(`${v.Year || ""} ${v.Make || ""} ${v.Model || ""}`.trim())} listing in a new tab">${esc(v.Year)} ${esc(v.Make)} ${esc(v.Model)} <span aria-hidden="true">↗</span></a></div>
          <div class="inventory-sub">VIN ${esc(v.VIN)} · ${esc(km(v.Mileage))} · ${esc(money(v.Price))} · ${photoCount} photo${photoCount === 1 ? "" : "s"}</div>
        </div>
      </div>
      <div class="inventory-controls">
        <div class="featured-slot" data-feature-slot></div>
        <label class="inventory-status-control"><span>Status</span><select class="inventory-status-select" data-status-select="${esc(v.id)}" aria-label="Status for ${esc(`${v.Year || ""} ${v.Make || ""} ${v.Model || ""}`.trim())}">${statusOptions.map(option => `<option value="${esc(option)}"${option.toLowerCase() === status.toLowerCase() ? " selected" : ""}>${esc(option)}</option>`).join("")}</select></label>
        <div class="row-actions"><button class="mini-btn" type="button" data-edit-workflow="${esc(v.id)}">Edit Vehicle</button></div>
      </div>
    </div>`;
  };
  const statusOf = vehicle => String(vehicle.Status || "Available").toLowerCase();
  const groups = [
    ["Available", vehicle => statusOf(vehicle) === "available"],
    ["Coming Soon", vehicle => ["coming soon", "pending"].includes(statusOf(vehicle))],
    ["Sold", vehicle => statusOf(vehicle) === "sold"],
    ["Other", vehicle => !["available", "coming soon", "pending", "sold"].includes(statusOf(vehicle))]
  ];
  list.innerHTML = groups.map(([name, matches]) => {
    const groupVehicles = filtered.filter(matches);
    if (!groupVehicles.length) return "";
    return `<details class="inventory-group" ${name === "Available" ? "open" : ""}><summary>${name} vehicles <span>${groupVehicles.length}</span></summary><div class="inventory-group-list">${groupVehicles.map(renderRow).join("")}</div></details>`;
  }).join("");

  list.querySelectorAll("[data-edit-workflow]").forEach(btn => btn.addEventListener("click", () => openVehicleWorkflow("edit", btn.dataset.editWorkflow)));
  list.querySelectorAll("[data-status-select]").forEach(select => select.addEventListener("change", async () => {
    await updateInventoryStatus(select.dataset.statusSelect, select.value, select);
  }));
}

async function updateInventoryStatus(id, status, select) {
  const previousStored = vehicles.find(vehicle => String(vehicle.id) === String(id))?.Status || "Available";
  const previous = String(previousStored).toLowerCase() === "pending" ? "Coming Soon" : previousStored;
  select.disabled = true;
  const { data, error } = await db.from("Vehicles").update({ Status: status }).eq("id", id).select("id,Status").single();
  select.disabled = false;
  if (error) {
    select.value = previous;
    toast("Could not update vehicle status: " + error.message);
    return;
  }
  const vehicle = vehicles.find(item => String(item.id) === String(id));
  if (vehicle) vehicle.Status = data?.Status || status;
  $("availableCount").textContent = vehicles.filter(item => ["available", "coming soon", "pending"].includes(String(item.Status || "Available").toLowerCase())).length;
  renderInventory();
  toast(`Vehicle status updated to ${data?.Status || status}.`);
}

function selectVehicle(id) {
  const vehicle = vehicles.find(v => String(v.id) === String(id));
  if (!vehicle) return;
  selectedVehicleId = vehicle.id;
  selectedSavedPhotoIds.clear();
  $("selectedVehicleLabel").textContent = `${vehicle.Year} ${vehicle.Make}`;
  $("uploadHint").textContent = `${vehicle.Year} ${vehicle.Make} ${vehicle.Model} · ${km(vehicle.Mileage)} · ${money(vehicle.Price)}`;
  $("photoInput").disabled = false;
  renderPhotos();
  renderInventory();
}

function publicImagePath(url) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = String(url || "").indexOf(marker);
  return idx >= 0 ? decodeURIComponent(String(url).slice(idx + marker.length)) : null;
}

async function uploadVehicleFiles(files) {
  if (!selectedVehicleId) return toast("Select a vehicle first.");
  const valid = validImageFiles(files);
  if (!valid.length) return toast("Please select image files.");

  const existing = (window.allPhotos || []).filter(p => String(p.vehicle_id) === String(selectedVehicleId));
  let nextOrder = Math.max(0, ...existing.map(p => Number(p.sort_order) || 0)) + 1;
  const progressWrap = $("uploadProgressWrap");
  const progress = $("uploadProgress");
  const progressText = $("uploadProgressText");
  progressWrap.classList.remove("hidden");

  try {
    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      const path = `${selectedVehicleId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

      progressText.textContent = `Uploading ${i + 1} of ${valid.length}: ${file.name}`;
      const { error: uploadError } = await db.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) throw uploadError;

      const { data: publicData } = db.storage.from(BUCKET).getPublicUrl(path);
      const imageRow = {
        vehicle_id: selectedVehicleId,
        image_url: publicData.publicUrl,
        alt_text: `${vehicles.find(v => String(v.id) === String(selectedVehicleId))?.Year || ""} ${vehicles.find(v => String(v.id) === String(selectedVehicleId))?.Make || ""} ${vehicles.find(v => String(v.id) === String(selectedVehicleId))?.Model || ""}`.trim(),
        sort_order: nextOrder,
        is_primary: existing.length === 0 && i === 0
      };

      const { error: insertError } = await db.from("vehicle_images").insert(imageRow);
      if (insertError) {
        await db.storage.from(BUCKET).remove([path]);
        throw insertError;
      }

      nextOrder++;
      existing.push(imageRow);
      progress.style.width = `${Math.round(((i + 1) / valid.length) * 100)}%`;
    }

    toast(`${valid.length} photo${valid.length === 1 ? "" : "s"} uploaded.`);
    await loadAll();
    selectVehicle(selectedVehicleId);
    $("photoInput").value = "";
    return true;
  } catch (error) {
    console.error(error);
    toast("Photo upload failed: " + error.message);
    return false;
  } finally {
    setTimeout(() => progressWrap.classList.add("hidden"), 800);
  }
}

function renderPhotos() {
  const grid = $("photoGrid");
  const images = (window.allPhotos || [])
    .filter(p => String(p.vehicle_id) === String(selectedVehicleId))
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));

  if (!images.length) {
    grid.className = "photo-grid empty-grid";
    grid.textContent = "No photos yet. Choose multiple files above to upload them all at once.";
    $("photoHelp").textContent = "No photos";
    selectedSavedPhotoIds.clear();
    updatePhotoSelectionControls(0, 0);
    return;
  }

  const imageIds = new Set(images.map(image => String(image.id)));
  selectedSavedPhotoIds = new Set([...selectedSavedPhotoIds].filter(id => imageIds.has(String(id))));

  grid.className = "photo-grid";
  $("photoHelp").textContent = `${images.length} photo${images.length === 1 ? "" : "s"} · Drag to reorder`;
  grid.innerHTML = images.map((img, index) => `<div class="photo-card ${selectedSavedPhotoIds.has(String(img.id)) ? "selected" : ""}" draggable="true" data-photo-id="${esc(img.id)}">
    <input class="photo-select" type="checkbox" data-select-saved-photo="${esc(img.id)}" aria-label="Select photo ${index + 1}" ${selectedSavedPhotoIds.has(String(img.id)) ? "checked" : ""}>
    <div class="photo-drag-handle" title="Drag to reorder" aria-label="Drag to reorder photo">☷</div>
    <img src="${esc(img.image_url)}" alt="${esc(img.alt_text || "Vehicle photo")}" loading="lazy">
    <div class="photo-info">
      ${img.is_primary ? `<strong>Primary photo</strong>` : `<span class="muted">Photo ${index + 1}</span>`}
      <div class="photo-actions">
        ${!img.is_primary ? `<button class="mini-btn" type="button" data-primary="${esc(img.id)}">Make primary</button>` : ""}
        <button class="mini-btn danger" type="button" data-delete-image="${esc(img.id)}">Delete</button>
      </div>
    </div>
  </div>`).join("");

  grid.querySelectorAll("[data-primary]").forEach(btn => btn.addEventListener("click", () => makePrimary(btn.dataset.primary)));
  grid.querySelectorAll("[data-delete-image]").forEach(btn => btn.addEventListener("click", () => deleteImage(btn.dataset.deleteImage)));
  grid.querySelectorAll("[data-select-saved-photo]").forEach(input => input.addEventListener("change", () => {
    const id = String(input.dataset.selectSavedPhoto);
    if (input.checked) selectedSavedPhotoIds.add(id); else selectedSavedPhotoIds.delete(id);
    input.closest(".photo-card").classList.toggle("selected", input.checked);
    updatePhotoSelectionControls(images.length, selectedSavedPhotoIds.size);
  }));
  bindPhotoCardDrag(grid, ".photo-card", savePhotoOrder);
  updatePhotoSelectionControls(images.length, selectedSavedPhotoIds.size);
}

async function savePhotoOrder(ids) {
  if (!selectedVehicleId || !ids.length) return;
  const photoById = new Map((window.allPhotos || []).map(photo => [String(photo.id), photo]));
  const ordered = ids.map(id => photoById.get(String(id))).filter(Boolean);

  try {
    // First move all rows into temporary, unique positions so a DB uniqueness
    // constraint on (vehicle_id, sort_order) cannot cause collisions.
    for (let i = 0; i < ordered.length; i++) {
      const { error } = await db.from("vehicle_images")
        .update({ sort_order: 1000000 + i })
        .eq("id", ordered[i].id)
        .eq("vehicle_id", selectedVehicleId);
      if (error) throw error;
    }

    for (let i = 0; i < ordered.length; i++) {
      const { error } = await db.from("vehicle_images")
        .update({ sort_order: i + 1, is_primary: i === 0 })
        .eq("id", ordered[i].id)
        .eq("vehicle_id", selectedVehicleId);
      if (error) throw error;
    }

    const byId = new Map(ordered.map((photo, index) => [String(photo.id), { ...photo, sort_order: index + 1, is_primary: index === 0 }]));
    window.allPhotos = (window.allPhotos || []).map(photo => byId.get(String(photo.id)) || photo);
    renderPhotos();
    toast("Photo order saved.");
  } catch (error) {
    console.error(error);
    toast("Could not save photo order: " + error.message);
    renderPhotos();
  }
}

async function makePrimary(imageId) {
  const current = (window.allPhotos || []).find(p => String(p.id) === String(imageId));
  if (!current) return;
  const { error: clearError } = await db.from("vehicle_images").update({ is_primary: false }).eq("vehicle_id", selectedVehicleId);
  if (clearError) return toast(clearError.message);
  const { error } = await db.from("vehicle_images").update({ is_primary: true, sort_order: 1 }).eq("id", imageId);
  if (error) return toast(error.message);
  // Keep sort order stable by moving the old primary to the next available slot.
  const others = (window.allPhotos || []).filter(p => String(p.vehicle_id) === String(selectedVehicleId) && String(p.id) !== String(imageId)).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
  for (let i=0;i<others.length;i++) await db.from("vehicle_images").update({ sort_order: i + 2 }).eq("id", others[i].id);
  toast("Primary photo updated.");
  await loadAll();
  selectVehicle(selectedVehicleId);
}

async function deleteImage(imageId) {
  await deleteImages([imageId]);
}

async function deleteImages(imageIds) {
  const ids = [...new Set(imageIds.map(String))];
  const images = (window.allPhotos || []).filter(photo => ids.includes(String(photo.id)) && String(photo.vehicle_id) === String(selectedVehicleId));
  if (!images.length) return;
  if (!confirm(`Permanently delete ${images.length} selected photo${images.length === 1 ? "" : "s"}?`)) return;

  const paths = images.map(image => publicImagePath(image.image_url)).filter(Boolean);
  if (paths.length) {
    const { error: storageError } = await db.storage.from(BUCKET).remove(paths);
    if (storageError) return toast("Could not delete photo files: " + storageError.message);
  }
  const { error } = await db.from("vehicle_images").delete().in("id", ids).eq("vehicle_id", selectedVehicleId);
  if (error) return toast(error.message);

  const removedPrimary = images.some(image => image.is_primary);
  selectedSavedPhotoIds.clear();
  await loadAll();
  const remaining = (window.allPhotos || []).filter(photo => String(photo.vehicle_id) === String(selectedVehicleId)).sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
  if (removedPrimary && remaining.length) await makePrimary(remaining[0].id);
  else selectVehicle(selectedVehicleId);
  toast(`${images.length} photo${images.length === 1 ? "" : "s"} deleted.`);
}

$("selectAllPhotos").addEventListener("change", event => {
  if (selectedVehicleId) {
    const images = (window.allPhotos || []).filter(photo => String(photo.vehicle_id) === String(selectedVehicleId));
    selectedSavedPhotoIds = event.target.checked ? new Set(images.map(photo => String(photo.id))) : new Set();
    renderPhotos();
  } else {
    selectedPendingFiles = event.target.checked ? new Set(pendingVehicleFiles) : new Set();
    renderPendingPhotos();
  }
});

$("removeSelectedPhotos").addEventListener("click", async () => {
  if (selectedVehicleId) {
    await deleteImages([...selectedSavedPhotoIds]);
    return;
  }
  if (!selectedPendingFiles.size) return;
  pendingVehicleFiles = pendingVehicleFiles.filter(file => !selectedPendingFiles.has(file));
  selectedPendingFiles.clear();
  renderPendingPhotos();
  toast("Selected photos removed from this vehicle.");
});

requireSession();
