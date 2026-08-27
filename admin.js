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
let selectedImages = [];
let activeAdminUserId = null;
let loadAllPromise = null;

async function requireSession() {
  const { data: { session } } = await db.auth.getSession();
  if (session) showAdmin(session);
  else showAuth();
}

function showAuth() {
  activeAdminUserId = null;
  $("authView").classList.remove("hidden");
  $("adminView").classList.add("hidden");
  $("sessionEmail").textContent = "";
}

function showAdmin(session) {
  const userId = session?.user?.id;
  const alreadyVisible = !$("adminView").classList.contains("hidden");
  $("authView").classList.add("hidden");
  $("adminView").classList.remove("hidden");
  $("sessionEmail").textContent = session.user.email || "Signed in";
  if (alreadyVisible && activeAdminUserId === userId) return;
  activeAdminUserId = userId;
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
  showAdmin(data.session);
});

const formValue = id => $(id)?.value?.trim() || "";
const optionalNumber = id => formValue(id) === "" ? null : Number(formValue(id));
const customSelectValue = (id, customId) => formValue(id) === "Other" ? (formValue(customId) || null) : (formValue(id) || null);

[["transmission", "transmissionCustom"], ["exteriorColor", "exteriorColorCustom"], ["interiorColor", "interiorColorCustom"]].forEach(([selectId, customId]) => {
  $(selectId)?.addEventListener("change", () => $(customId)?.classList.toggle("hidden", formValue(selectId) !== "Other"));
});

$("signOutBtn").addEventListener("click", async () => {
  await db.auth.signOut();
  selectedVehicleId = null;
  showAuth();
});

db.auth.onAuthStateChange((_event, session) => {
  if (session) showAdmin(session);
  else showAuth();
});

$("vehicleForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = $("vehicleStatus");
  status.textContent = "Saving vehicle…";

  const row = {
    VIN: formValue("vin"),
    Year: optionalNumber("year"),
    Make: formValue("make"),
    Model: formValue("model"),
    Trim: formValue("trim") || null,
    Mileage: optionalNumber("mileage"),
    Price: optionalNumber("price"),
    Status: formValue("status"),
    Transmission: customSelectValue("transmission", "transmissionCustom"),
    BodyStyle: formValue("bodyStyle") || null,
    EngineCylinders: optionalNumber("engineCylinders"),
    EngineSize: optionalNumber("engineSize"),
    Drivetrain: formValue("drivetrain") || null,
    ExteriorColor: customSelectValue("exteriorColor", "exteriorColorCustom"),
    InteriorColor: customSelectValue("interiorColor", "interiorColorCustom"),
    Doors: optionalNumber("doors"),
    FuelType: formValue("fuelType") || null,
    Passengers: optionalNumber("passengers"),
    AdditionalInfo: formValue("additionalInfo") || null,
    Description: formValue("description") || null,
    CarfaxURL: formValue("carfaxUrl") || null
  };

  const { data, error } = await db.from("Vehicles").insert(row).select().single();
  if (error) {
    console.error(error);
    status.textContent = error.message;
    return;
  }

  status.textContent = "Vehicle added.";
  toast("Vehicle added successfully.");
  $("vehicleForm").reset();
  $("status").value = "Available";
  ["transmissionCustom", "exteriorColorCustom", "interiorColorCustom"].forEach(id => $(id)?.classList.add("hidden"));
  selectedVehicleId = data.id;
  await loadAll();
  selectVehicle(data.id);
});

$("resetFormBtn").addEventListener("click", () => {
  $("vehicleForm").reset();
  $("status").value = "Available";
  $("vehicleStatus").textContent = "";
  $("vinLookupStatus").textContent = "";
  ["transmissionCustom", "exteriorColorCustom", "interiorColorCustom"].forEach(id => $(id)?.classList.add("hidden"));
});

$("refreshBtn").addEventListener("click", loadAll);
$("inventorySearch").addEventListener("input", renderInventory);

const dropZone = $("dropZone");
dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (!selectedVehicleId) return toast("Select a vehicle first.");
  handleFiles([...e.dataTransfer.files]);
});
$("photoInput").addEventListener("change", (e) => handleFiles([...e.target.files]));

function loadAll() {
  if (loadAllPromise) return loadAllPromise;

  loadAllPromise = (async () => {
    try {
    const { data, error } = await db.from("Vehicles").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    vehicles = data || [];
    $("availableCount").textContent = vehicles.filter(v => String(v.Status || "Available").toLowerCase() === "available").length;
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
    const selected = String(v.id) === String(selectedVehicleId);
    const status = String(v.Status || "Available");
    const photoCount = (window.allPhotos || []).filter(p => String(p.vehicle_id) === String(v.id)).length;
    return `<div class="inventory-row" data-id="${esc(v.id)}">
      <div>
        <div class="inventory-title">${esc(v.Year)} ${esc(v.Make)} ${esc(v.Model)}</div>
        <div class="inventory-sub">VIN ${esc(v.VIN)} · ${esc(km(v.Mileage))} · ${esc(money(v.Price))} · ${photoCount} photo${photoCount === 1 ? "" : "s"}</div>
      </div>
      <span class="badge ${status.toLowerCase() === "available" ? "available" : ""}">${esc(status)}</span>
      <div class="row-actions"><button class="mini-btn" type="button" data-select="${esc(v.id)}">${selected ? "Selected" : "Manage Photos"}</button></div>
    </div>`;
  };
  const statusOf = vehicle => String(vehicle.Status || "Available").toLowerCase();
  const groups = [
    ["Available", vehicle => statusOf(vehicle) === "available"],
    ["Sold", vehicle => statusOf(vehicle) === "sold"],
    ["Other", vehicle => !["available", "sold"].includes(statusOf(vehicle))]
  ];
  list.innerHTML = groups.map(([name, matches]) => {
    const groupVehicles = filtered.filter(matches);
    if (!groupVehicles.length) return "";
    return `<details class="inventory-group" ${name === "Available" ? "open" : ""}><summary>${name} vehicles <span>${groupVehicles.length}</span></summary><div class="inventory-group-list">${groupVehicles.map(renderRow).join("")}</div></details>`;
  }).join("");

  list.querySelectorAll("[data-select]").forEach(btn => btn.addEventListener("click", () => selectVehicle(btn.dataset.select)));
}

function selectVehicle(id) {
  const vehicle = vehicles.find(v => String(v.id) === String(id));
  if (!vehicle) return;
  selectedVehicleId = vehicle.id;
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

async function handleFiles(files) {
  if (!selectedVehicleId) return toast("Select a vehicle first.");
  const valid = files.filter(file => file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic)$/i.test(file.name));
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
  } catch (error) {
    console.error(error);
    toast("Photo upload failed: " + error.message);
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
    return;
  }

  grid.className = "photo-grid";
  $("photoHelp").textContent = `${images.length} photo${images.length === 1 ? "" : "s"} · Drag to reorder`;
  grid.innerHTML = images.map((img, index) => `<div class="photo-card" draggable="true" data-photo-id="${esc(img.id)}">
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

  let draggedId = null;
  grid.querySelectorAll(".photo-card").forEach(card => {
    card.addEventListener("dragstart", (event) => {
      draggedId = card.dataset.photoId;
      card.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedId);
    });

    card.addEventListener("dragend", async () => {
      card.classList.remove("dragging");
      const ids = [...grid.querySelectorAll(".photo-card")].map(el => el.dataset.photoId);
      if (!draggedId || !ids.includes(draggedId)) return;
      await savePhotoOrder(ids);
      draggedId = null;
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      const dragging = grid.querySelector(".photo-card.dragging");
      if (!dragging || dragging === card) return;

      const rect = card.getBoundingClientRect();
      const before = event.clientY < rect.top + rect.height / 2;
      const reference = before ? card : card.nextElementSibling;
      if (reference !== dragging) grid.insertBefore(dragging, reference);
    });
  });
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
        .update({ sort_order: i + 1 })
        .eq("id", ordered[i].id)
        .eq("vehicle_id", selectedVehicleId);
      if (error) throw error;
    }

    const byId = new Map(ordered.map((photo, index) => [String(photo.id), { ...photo, sort_order: index + 1 }]));
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
  const image = (window.allPhotos || []).find(p => String(p.id) === String(imageId));
  if (!image) return;
  if (!confirm("Delete this photo?")) return;

  const path = publicImagePath(image.image_url);
  if (path) await db.storage.from(BUCKET).remove([path]);
  const { error } = await db.from("vehicle_images").delete().eq("id", imageId);
  if (error) return toast(error.message);
  toast("Photo deleted.");
  await loadAll();
  selectVehicle(selectedVehicleId);
}

requireSession();
