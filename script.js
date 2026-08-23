// M.O Motors — Supabase inventory connection + homepage photo galleries
const SUPABASE_URL = "https://dpsgtliddmdvfwjahkkq.supabase.co";
const SUPABASE_KEY = "sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0";

const menuBtn = document.getElementById("menuBtn");
const nav = document.getElementById("nav");
const inventoryGrid = document.getElementById("inventoryGrid");
const makeFilter = document.getElementById("makeFilter");
const modelFilter = document.getElementById("modelFilter");
const priceFilter = document.getElementById("priceFilter");
const searchButton = document.getElementById("searchInventory");

if (document.getElementById("year")) {
  document.getElementById("year").textContent = new Date().getFullYear();
}

menuBtn?.addEventListener("click", () => nav?.classList.toggle("open"));
nav?.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => nav?.classList.remove("open"))
);

const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        maximumFractionDigits: 0
      }).format(n)
    : "$—";
};

const km = (value) => {
  const n = Number(value);
  return Number.isFinite(n)
    ? `${new Intl.NumberFormat("en-CA").format(n)} km`
    : "Mileage N/A";
};

const pick = (obj, ...keys) => {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null && obj?.[key] !== "") return obj[key];
  }
  return "";
};

async function supabaseGet(table, params = {}) {
  const qs = new URLSearchParams(params);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(table)}?${qs}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table} request failed (${response.status}): ${text}`);
  }
  return response.json();
}

function imageUrl(row) {
  const direct = pick(row, "image_url", "imageUrl", "url", "public_url", "publicUrl", "storage_url");
  if (direct && /^https?:\/\//i.test(direct)) return direct;

  const path = pick(row, "storage_path", "storagePath", "path", "file_path", "filePath");
  if (!path) return "";

  const bucket = pick(row, "bucket", "bucket_name", "bucketName") || "vehicle-images";
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(bucket)}/${String(path).split("/").map(encodeURIComponent).join("/")}`;
}

function getVehicleId(vehicle) {
  return pick(vehicle, "id", "ID");
}

async function getVehicles() {
  const vehicles = await supabaseGet("Vehicles", {
    select: "*",
    order: "created_at.desc",
    limit: "24"
  });

  return vehicles.filter((v) => {
    const status = String(pick(v, "Status", "status") || "Available").toLowerCase();
    return !status || status === "available" || status === "in stock" || status === "active";
  });
}

async function getVehicleImages(vehicles) {
  if (!vehicles.length) return new Map();

  try {
    const rows = await supabaseGet("vehicle_images", {
      select: "*",
      order: "sort_order.asc,created_at.asc"
    });

    const vehicleIds = new Set(vehicles.map(getVehicleId).filter(Boolean).map(String));
    const map = new Map();

    for (const row of rows) {
      const id = pick(row, "vehicle_id", "vehicleId", "Vehicles_id", "vehicles_id", "vehicle");
      const url = imageUrl(row);
      if (!id || !url || !vehicleIds.has(String(id))) continue;

      const key = String(id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        url,
        isPrimary: Boolean(pick(row, "is_primary", "isPrimary")),
        sortOrder: Number(pick(row, "sort_order", "sortOrder")) || 999999
      });
    }

    for (const photos of map.values()) {
      photos.sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      });
    }

    return map;
  } catch (error) {
    console.warn("Vehicle image table could not be loaded:", error);
    return new Map();
  }
}

function populateFilters(vehicles) {
  const makes = [...new Set(vehicles.map(v => String(pick(v, "Make", "make")).trim()).filter(Boolean))].sort();
  const models = [...new Set(vehicles.map(v => String(pick(v, "Model", "model")).trim()).filter(Boolean))].sort();
  const priceRanges = [
    ["under-20000", "Under $20,000"],
    ["20000-30000", "$20,000–$29,999"],
    ["30000-50000", "$30,000–$49,999"],
    ["50000-plus", "$50,000+"]
  ];

  if (makeFilter) makeFilter.innerHTML = '<option value="">Any Make</option>' + makes.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
  if (modelFilter) modelFilter.innerHTML = '<option value="">Any Model</option>' + models.map(x => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
  if (priceFilter) priceFilter.innerHTML = '<option value="">Any Price</option>' + priceRanges.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
}

function priceMatches(price, range) {
  if (!range) return true;
  const n = Number(price);
  if (!Number.isFinite(n)) return false;
  if (range === "under-20000") return n < 20000;
  if (range === "20000-30000") return n >= 20000 && n < 30000;
  if (range === "30000-50000") return n >= 30000 && n < 50000;
  if (range === "50000-plus") return n >= 50000;
  return true;
}

function renderVehicles(vehicles, imageMap) {
  if (!inventoryGrid) return;

  if (!vehicles.length) {
    inventoryGrid.innerHTML = `<div class="inventory-empty">No vehicles match your search. Check back soon for new inventory.</div>`;
    return;
  }

  inventoryGrid.innerHTML = vehicles.slice(0, 6).map((vehicle) => {
    const id = getVehicleId(vehicle);
    const year = pick(vehicle, "Year", "year");
    const make = pick(vehicle, "Make", "make");
    const model = pick(vehicle, "Model", "model");
    const mileage = pick(vehicle, "Mileage", "mileage");
    const price = pick(vehicle, "Price", "price");
    const transmission = pick(vehicle, "Transmission", "transmission", "transmission_type") || "Automatic";
    const photos = imageMap.get(String(id)) || [];
    const title = [year, make, model].filter(Boolean).join(" ") || "Vehicle";
    const safeId = esc(id);

    if (!photos.length) {
      return `<article class="vehicle-card">
        <div class="vehicle-image placeholder">
          <span>PHOTO COMING SOON</span>
        </div>
        <div class="vehicle-info">
          <p class="vehicle-year">FEATURED VEHICLE</p>
          <h3>${esc(title)}</h3>
          <div class="vehicle-meta"><span>${esc(km(mileage))}</span><span>${esc(transmission)}</span><span>Pre-Owned</span></div>
          <div class="price-row"><strong>${esc(money(price))}</strong><a href="#contact" aria-label="Ask about ${esc(title)}">View Details →</a></div>
        </div>
      </article>`;
    }

    const startIndex = 0;
    const photoSources = photos.map((p) => p.url);
    const dots = photos.map((_, index) =>
      `<button class="vehicle-dot${index === startIndex ? " active" : ""}" type="button" data-gallery-id="${safeId}" data-gallery-index="${index}" aria-label="View photo ${index + 1}"></button>`
    ).join("");

    return `<article class="vehicle-card" data-vehicle-id="${safeId}">
      <div class="vehicle-image vehicle-gallery" data-gallery-id="${safeId}" data-gallery-index="${startIndex}">
        <img class="vehicle-gallery-image" src="${esc(photoSources[startIndex])}" alt="${esc(title)}" loading="lazy">
        ${photos.length > 1 ? `
          <button class="gallery-arrow gallery-prev" type="button" data-gallery-id="${safeId}" data-gallery-direction="prev" aria-label="Previous photo">‹</button>
          <button class="gallery-arrow gallery-next" type="button" data-gallery-id="${safeId}" data-gallery-direction="next" aria-label="Next photo">›</button>
          <div class="vehicle-dots" aria-label="Photo selector">${dots}</div>
          <span class="photo-count">1 / ${photos.length}</span>
        ` : ""}
      </div>
      <div class="vehicle-info">
        <p class="vehicle-year">FEATURED VEHICLE</p>
        <h3>${esc(title)}</h3>
        <div class="vehicle-meta"><span>${esc(km(mileage))}</span><span>${esc(transmission)}</span><span>Pre-Owned</span></div>
        <div class="price-row"><strong>${esc(money(price))}</strong><a href="#contact" aria-label="Ask about ${esc(title)}">View Details →</a></div>
      </div>
    </article>`;
  }).join("");

  inventoryGrid.querySelectorAll(".vehicle-gallery").forEach((gallery) => {
    gallery.dataset.photos = JSON.stringify((imageMap.get(String(gallery.dataset.galleryId)) || []).map(p => p.url));
  });
}

function changeGallery(gallery, nextIndex) {
  const photos = JSON.parse(gallery.dataset.photos || "[]");
  if (!photos.length) return;

  const current = Number(gallery.dataset.galleryIndex) || 0;
  const index = ((nextIndex % photos.length) + photos.length) % photos.length;
  if (index === current && photos.length > 1) return;

  gallery.dataset.galleryIndex = String(index);
  const img = gallery.querySelector(".vehicle-gallery-image");
  if (img) {
    img.classList.add("is-changing");
    window.setTimeout(() => {
      img.src = photos[index];
      img.classList.remove("is-changing");
    }, 100);
  }

  gallery.querySelectorAll(".vehicle-dot").forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === index);
  });

  const count = gallery.querySelector(".photo-count");
  if (count) count.textContent = `${index + 1} / ${photos.length}`;
}

inventoryGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-gallery-id]");
  if (!button) return;

  const galleryId = button.dataset.galleryId;
  const gallery = inventoryGrid.querySelector(`.vehicle-gallery[data-gallery-id="${CSS.escape(String(galleryId))}"]`);
  if (!gallery) return;

  if (button.dataset.galleryIndex !== undefined) {
    changeGallery(gallery, Number(button.dataset.galleryIndex));
    return;
  }

  const photos = JSON.parse(gallery.dataset.photos || "[]");
  const current = Number(gallery.dataset.galleryIndex) || 0;
  const direction = button.dataset.galleryDirection === "prev" ? -1 : 1;
  changeGallery(gallery, current + direction);
});

function enableSwipeGalleries() {
  if (!inventoryGrid) return;
  let startX = 0;
  let startY = 0;

  inventoryGrid.addEventListener("touchstart", (event) => {
    const gallery = event.target.closest(".vehicle-gallery");
    if (!gallery || event.touches.length !== 1) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
    gallery.dataset.touching = "true";
  }, { passive: true });

  inventoryGrid.addEventListener("touchend", (event) => {
    const gallery = event.target.closest(".vehicle-gallery");
    if (!gallery || gallery.dataset.touching !== "true") return;
    gallery.dataset.touching = "false";
    const touch = event.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;

    const current = Number(gallery.dataset.galleryIndex) || 0;
    changeGallery(gallery, current + (dx < 0 ? 1 : -1));
  }, { passive: true });
}

enableSwipeGalleries();

function applyFilters(allVehicles, imageMap) {
  const make = makeFilter?.value || "";
  const model = modelFilter?.value || "";
  const range = priceFilter?.value || "";
  const filtered = allVehicles.filter((v) => {
    const vMake = String(pick(v, "Make", "make"));
    const vModel = String(pick(v, "Model", "model"));
    const vPrice = pick(v, "Price", "price");
    return (!make || vMake === make) && (!model || vModel === model) && priceMatches(vPrice, range);
  });
  renderVehicles(filtered, imageMap);
}

async function loadInventory() {
  if (!inventoryGrid) return;
  inventoryGrid.innerHTML = `<div class="inventory-loading">Loading our latest vehicles…</div>`;

  try {
    const allVehicles = await getVehicles();
    populateFilters(allVehicles);
    const imageMap = await getVehicleImages(allVehicles);
    renderVehicles(allVehicles, imageMap);

    searchButton?.addEventListener("click", () => applyFilters(allVehicles, imageMap));
    makeFilter?.addEventListener("change", () => applyFilters(allVehicles, imageMap));
    modelFilter?.addEventListener("change", () => applyFilters(allVehicles, imageMap));
    priceFilter?.addEventListener("change", () => applyFilters(allVehicles, imageMap));
  } catch (error) {
    console.error(error);
    inventoryGrid.innerHTML = `<div class="inventory-empty">We couldn't load inventory right now. Please call M.O Motors at <a href="tel:+12049634462">204-963-4462</a>.</div>`;
  }
}

loadInventory();
