(() => {
  let initialized = false;
  const labels = {
    warranty: "Warranty",
    vehicle_sourcing: "Vehicle Sourcing",
    service_repair: "Service & Repair",
    vehicle_disposition: "Sell / Trade / Consign",
    referral: "Referral",
  };
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const title = (key) =>
    String(key)
      .replaceAll("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  const fmt = (value) =>
    value
      ? new Date(value).toLocaleString("en-CA", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";
  function detailValue(value) {
    return Array.isArray(value)
      ? value.join(", ")
      : typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : String(value ?? "—");
  }
  function init() {
    if (initialized) return;
    const list = document.getElementById("requestsList");
    if (!list) return;
    initialized = true;
    let rows = [],
      filter = "all",
      loading = false;
    function render() {
      const visible =
        filter === "all"
          ? rows
          : rows.filter((row) => row.request_type === filter);
      if (!visible.length) {
        list.innerHTML =
          '<div class="request-empty">No customer requests in this category.</div>';
        return;
      }
      list.innerHTML = visible
        .map((row) => {
          const details = Object.entries(row.details || {}).filter(
            ([, value]) =>
              value !== "" &&
              value !== null &&
              !(Array.isArray(value) && !value.length),
          );
          return `<article class="request-card"><div class="request-main"><div class="request-title-row"><div><span class="request-type">${esc(labels[row.request_type] || row.request_type)}</span><h4>${esc(row.first_name)} ${esc(row.last_name)}</h4></div><span class="request-submitted">Submitted ${esc(fmt(row.created_at))}</span></div><div class="request-contact"><div><span>Phone</span><a href="tel:${esc(row.phone)}">${esc(row.phone)}</a></div><div><span>Email</span><a href="mailto:${esc(row.email)}">${esc(row.email)}</a></div></div><div class="request-detail-grid">${details.map(([key, value]) => `<div><span>${esc(title(key))}</span><strong>${esc(detailValue(value))}</strong></div>`).join("") || "<div><span>Details</span><strong>No additional details</strong></div>"}</div></div><div class="request-actions"><label>Status<select data-request-status="${esc(row.id)}"><option ${row.status === "New" ? "selected" : ""}>New</option><option ${row.status === "Contacted" ? "selected" : ""}>Contacted</option><option ${row.status === "In Progress" ? "selected" : ""}>In Progress</option><option ${row.status === "Completed" ? "selected" : ""}>Completed</option><option ${row.status === "Cancelled" ? "selected" : ""}>Cancelled</option></select></label><button class="mini-btn" data-save-request="${esc(row.id)}" type="button">Save</button></div></article>`;
        })
        .join("");
      list.querySelectorAll("[data-save-request]").forEach((button) =>
        button.addEventListener("click", async () => {
          const id = button.dataset.saveRequest,
            status = list.querySelector(
              `[data-request-status="${CSS.escape(id)}"]`,
            ).value;
          button.disabled = true;
          try {
            const { error } = await db
              .from("customer_requests")
              .update({ status })
              .eq("id", id);
            if (error) throw error;
            const item = rows.find((row) => String(row.id) === String(id));
            if (item) item.status = status;
            toast("Customer request updated.");
            render();
          } catch (error) {
            toast("Could not update request: " + error.message);
          } finally {
            button.disabled = false;
          }
        }),
      );
    }
    async function load() {
      if (
        loading ||
        document.getElementById("adminView")?.classList.contains("hidden")
      )
        return;
      loading = true;
      list.innerHTML = '<div class="muted">Loading customer requests…</div>';
      try {
        const { data, error } = await db
          .from("customer_requests")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        rows = data || [];
        render();
      } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="request-empty">Could not load customer requests: ${esc(error.message)}</div>`;
      } finally {
        loading = false;
      }
    }
    document
      .getElementById("refreshRequestsBtn")
      ?.addEventListener("click", load);
    document
      .getElementById("requestFilters")
      ?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-request-filter]");
        if (!button) return;
        filter = button.dataset.requestFilter;
        document
          .querySelectorAll("[data-request-filter]")
          .forEach((item) => item.classList.toggle("active", item === button));
        render();
      });
    window.loadCustomerRequests = load;
    if (location.hash.slice(1) === "requests") load();
  }
  function start() {
    if (document.getElementById("requestsList")) init();
    else setTimeout(start, 100);
  }
  document.addEventListener("DOMContentLoaded", start);
  window.addEventListener("adminpanelsready", init);
})();
