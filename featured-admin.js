(() => {
  if (typeof db === "undefined") return;
  const list = document.getElementById("inventoryList");
  if (!list) return;
  let rows = [], dirty = false, saving = false;
  const featured = () => rows.filter(v => v.Featured === true).sort((a,b) => (Number(a.featured_order)||999) - (Number(b.featured_order)||999));

  async function sync() {
    const {data,error} = await db.from("Vehicles").select("id,Featured,featured_order");
    if (error) { console.error(error); return; }
    rows = data || [];
    dirty = false;
    decorate();
  }

  function toggle(id, on) {
    const vehicle = rows.find(v => String(v.id) === String(id));
    if (!vehicle) return;
    if (on) {
      if (featured().length >= 6) { toast("You can feature up to 6 vehicles."); decorate(); return; }
      vehicle.Featured = true;
      vehicle.featured_order = featured().length + 1;
    } else {
      vehicle.Featured = false;
      vehicle.featured_order = null;
    }
    dirty = true;
    decorate();
  }

  function setPosition(id, position) {
    const ordered = featured();
    const vehicle = ordered.find(v => String(v.id) === String(id));
    if (!vehicle) return;
    const nextPosition = Math.max(1, Math.min(6, Number(position) || 1));
    const without = ordered.filter(v => String(v.id) !== String(id));
    without.splice(Math.min(nextPosition - 1, without.length), 0, vehicle);
    without.forEach((v,index) => v.featured_order = index + 1);
    dirty = true;
    decorate();
  }

  async function save() {
    if (saving || !dirty) return;
    saving = true;
    decorate();
    try {
      const active = featured();
      for (let index = 0; index < active.length; index++) {
        const {error} = await db.from("Vehicles").update({Featured:true,featured_order:index+1}).eq("id", active[index].id);
        if (error) throw error;
      }
      for (const vehicle of rows.filter(v => v.Featured !== true)) {
        const {error} = await db.from("Vehicles").update({Featured:false,featured_order:null}).eq("id", vehicle.id);
        if (error) throw error;
      }
      dirty = false;
      toast("Featured vehicles saved.");
      await sync();
    } catch (error) {
      console.error(error);
      toast("Could not save featured vehicles: " + error.message);
    } finally {
      saving = false;
      decorate();
    }
  }

  function ensureSaveButton() {
    let bar = document.getElementById("featuredSaveBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "featuredSaveBar";
      bar.className = "featured-save-bar";
      bar.innerHTML = '<span>Featured changes not saved</span><button type="button" class="primary-btn">Save Featured Order</button>';
      list.parentElement?.insertBefore(bar, list);
      bar.querySelector("button").addEventListener("click", save);
    }
    bar.classList.toggle("hidden", !dirty);
    const button = bar.querySelector("button");
    button.disabled = saving;
    button.textContent = saving ? "Saving…" : "Save Featured Order";
  }

  function decorate() {
    list.querySelectorAll(".inventory-row").forEach(row => {
      const actions = row.querySelector(".row-actions");
      if (!actions) return;
      const id = row.dataset.id;
      const vehicle = rows.find(v => String(v.id) === String(id));
      if (!vehicle) return;
      let toggleButton = row.querySelector("[data-feature-toggle]");
      if (!toggleButton) {
        toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "featured-toggle";
        toggleButton.dataset.featureToggle = id;
        actions.prepend(toggleButton);
        toggleButton.addEventListener("click", () => toggle(id, !vehicle.Featured));
      }
      toggleButton.textContent = vehicle.Featured ? "Remove Featured" : "Feature";
      toggleButton.classList.toggle("is-featured", vehicle.Featured);

      let control = row.querySelector("[data-featured-position]");
      if (!vehicle.Featured) { control?.remove(); return; }
      if (!control) {
        control = document.createElement("label");
        control.className = "featured-position";
        control.dataset.featuredPosition = id;
        control.innerHTML = 'Featured order <select aria-label="Featured order"></select>';
        actions.appendChild(control);
        control.querySelector("select").addEventListener("change", event => setPosition(id, event.target.value));
      }
      const position = featured().findIndex(v => String(v.id) === String(id)) + 1;
      const select = control.querySelector("select");
      const options = [1,2,3,4,5,6].map(number => `<option value="${number}" ${number===position?"selected":""}>${number}</option>`).join("");
      if (select.innerHTML !== options) select.innerHTML = options;
      select.disabled = saving;
    });
    ensureSaveButton();
  }

  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(list, {childList:true,subtree:false});
  sync();
})();
