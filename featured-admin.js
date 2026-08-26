(() => {
  const db = window.db;
  const list = document.getElementById("inventoryList");
  if (!db || !list) return;

  const statusRank = { available: 0, pending: 1, hold: 2, sold: 3 };
  let sortScheduled = false;

  function featuredVehicles() {
    return (window.__featuredVehicles || [])
      .filter(v => v.Featured === true)
      .sort((a, b) => (Number(a.featured_order) || 999999) - (Number(b.featured_order) || 999999));
  }

  function sortInventory() {
    const rows = [...list.querySelectorAll(".inventory-row")];
    if (rows.length < 2) return;
    const ranked = rows.map((row, index) => {
      const status = String(row.querySelector(".badge")?.textContent || "Available").trim().toLowerCase();
      return { row, index, rank: statusRank[status] ?? 99 };
    });
    ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
    if (ranked.every((item, index) => item.row === rows[index])) return;
    const fragment = document.createDocumentFragment();
    ranked.forEach(item => fragment.appendChild(item.row));
    list.appendChild(fragment);
  }

  function scheduleSort() {
    if (sortScheduled) return;
    sortScheduled = true;
    requestAnimationFrame(() => {
      sortScheduled = false;
      sortInventory();
    });
  }

  async function syncVehicles() {
    const { data, error } = await db.from("Vehicles").select("id, Featured, featured_order");
    if (error) { console.error(error); return; }
    window.__featuredVehicles = data || [];
    addFeaturedControls();
    sortInventory();
  }

  async function moveFeatured(id, direction) {
    const ordered = featuredVehicles();
    const index = ordered.findIndex(v => String(v.id) === String(id));
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const current = ordered[index], target = ordered[targetIndex];
    const currentOrder = Number(current.featured_order) || index + 1;
    const targetOrder = Number(target.featured_order) || targetIndex + 1;
    const { error: firstError } = await db.from("Vehicles").update({ featured_order: targetOrder }).eq("id", current.id);
    if (firstError) { alert("Could not save featured order: " + firstError.message); return; }
    const { error: secondError } = await db.from("Vehicles").update({ featured_order: currentOrder }).eq("id", target.id);
    if (secondError) { alert("Could not save featured order: " + secondError.message); return; }
    await syncVehicles();
  }

  function addFeaturedControls() {
    list.querySelectorAll(".inventory-row").forEach(row => {
      const actions = row.querySelector(".row-actions");
      if (!actions) return;
      const id = row.dataset.id;
      const vehicle = (window.__featuredVehicles || []).find(v => String(v.id) === String(id));
      if (!vehicle) return;
      const featured = vehicle.Featured === true;
      let button = row.querySelector("[data-featured-toggle]");
      if (!button) {
        button = document.createElement("button");
        button.type = "button";
        button.dataset.featuredToggle = id;
        button.addEventListener("click", async () => {
          const next = !button.classList.contains("is-featured");
          button.disabled = true;
          button.textContent = "Saving…";
          const currentFeatured = featuredVehicles();
          const nextOrder = currentFeatured.length ? Math.max(...currentFeatured.map(v => Number(v.featured_order) || 0)) + 1 : 1;
          const update = next ? { Featured: true, featured_order: nextOrder } : { Featured: false, featured_order: null };
          const { error } = await db.from("Vehicles").update(update).eq("id", id);
          if (error) alert("Could not update featured status: " + error.message);
          await syncVehicles();
        });
        actions.prepend(button);
      }
      button.disabled = false;
      button.className = `featured-toggle ${featured ? "is-featured" : ""}`;
      button.innerHTML = `<span class="featured-dot"></span>${featured ? "Featured" : "Feature"}`;

      let orderControls = row.querySelector("[data-featured-order]");
      if (featured && !orderControls) {
        orderControls = document.createElement("span");
        orderControls.className = "featured-order-controls";
        orderControls.dataset.featuredOrder = id;
        orderControls.innerHTML = '<button type="button" aria-label="Move featured vehicle up">↑</button><button type="button" aria-label="Move featured vehicle down">↓</button>';
        const [up, down] = orderControls.querySelectorAll("button");
        up.addEventListener("click", () => moveFeatured(id, -1));
        down.addEventListener("click", () => moveFeatured(id, 1));
        button.insertAdjacentElement("afterend", orderControls);
      }
      if (!featured && orderControls) orderControls.remove();
      if (featured && orderControls) {
        const index = featuredVehicles().findIndex(v => String(v.id) === String(id));
        const buttons = orderControls.querySelectorAll("button");
        buttons[0].disabled = index <= 0;
        buttons[1].disabled = index < 0 || index >= featuredVehicles().length - 1;
      }
    });
  }

  const observer = new MutationObserver(() => {
    addFeaturedControls();
    scheduleSort();
  });
  observer.observe(list, { childList: true, subtree: true });

  syncVehicles();
  setInterval(() => {
    if (!document.getElementById("adminView")?.classList.contains("hidden")) syncVehicles();
  }, 30000);
})();
