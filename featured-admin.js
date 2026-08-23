(() => {
  const SUPABASE_URL = "https://dpsgtliddmdvfwjahkkq.supabase.co";
  const SUPABASE_KEY = "sb_publishable_f-MRqpvq-FGsxQ7dBNIyKQ_r8MB1VM0";
  const { createClient } = window.supabase;
  const db = createClient(SUPABASE_URL, SUPABASE_KEY);
  const list = document.getElementById("inventoryList");
  if (!list) return;

  function addFeaturedControls() {
    list.querySelectorAll(".inventory-row").forEach((row) => {
      if (row.querySelector("[data-featured-toggle]")) return;
      const id = row.dataset.id;
      const vehicle = (window.__featuredVehicles || []).find(v => String(v.id) === String(id));
      if (!vehicle) return;
      const featured = vehicle.Featured === true;
      const actions = row.querySelector(".row-actions");
      if (!actions) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `featured-toggle ${featured ? "is-featured" : ""}`;
      button.dataset.featuredToggle = id;
      button.innerHTML = `<span class="featured-dot"></span>${featured ? "Featured" : "Feature"}`;
      button.addEventListener("click", async () => {
        const next = !button.classList.contains("is-featured");
        button.disabled = true;
        button.textContent = "Saving…";
        const { error } = await db.from("Vehicles").update({ Featured: next }).eq("id", id);
        if (error) {
          console.error(error);
          alert("Could not update featured status: " + error.message);
        } else {
          vehicle.Featured = next;
          button.className = `featured-toggle ${next ? "is-featured" : ""}`;
          button.innerHTML = `<span class="featured-dot"></span>${next ? "Featured" : "Feature"}`;
        }
        button.disabled = false;
      });
      actions.prepend(button);
    });
  }

  async function syncVehicles() {
    const { data, error } = await db.from("Vehicles").select("id, Featured");
    if (!error) {
      window.__featuredVehicles = data || [];
      addFeaturedControls();
    }
  }

  const observer = new MutationObserver(() => addFeaturedControls());
  observer.observe(list, { childList: true, subtree: true });
  syncVehicles();
  setInterval(syncVehicles, 30000);
})();