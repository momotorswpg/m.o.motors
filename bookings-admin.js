(() => {
  let initialized = false;
  function init() {
    if (initialized) return;
    const list = document.getElementById("bookingsList");
    if (!list) return;
    initialized = true;
    let bookings = [], loading = false;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
    const fmt = value => value ? new Date(value).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" }) : "—";
    const dayKey = value => String(value || "").slice(0, 10);
    const dateKey = offset => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
    const dateCategory = booking => { const date = dayKey(booking.preferred_date); if (!date) return "other"; if (date < dateKey(0)) return "past"; if (date === dateKey(0)) return "today"; if (date === dateKey(1)) return "tomorrow"; return "upcoming"; };
    const vehicleName = booking => booking.Vehicles ? `${booking.Vehicles.Year || ""} ${booking.Vehicles.Make || ""} ${booking.Vehicles.Model || ""}`.trim() : (booking.vehicle_name || "Vehicle not specified");

    const modal = document.createElement("div");
    modal.className = "booking-modal hidden";
    modal.innerHTML = '<div class="booking-modal-backdrop"></div><section class="booking-modal-card" role="dialog" aria-modal="true"><button class="booking-modal-close" type="button" aria-label="Close">×</button><div id="bookingModalContent"></div></section>';
    document.body.appendChild(modal);
    const closeModal = () => modal.classList.add("hidden");
    modal.querySelector(".booking-modal-backdrop").addEventListener("click", closeModal);
    modal.querySelector(".booking-modal-close").addEventListener("click", closeModal);

    function openDetails(booking) {
      document.getElementById("bookingModalContent").innerHTML = `<span class="eyebrow">BOOKING DETAILS</span><h3>${esc(booking.first_name || "")} ${esc(booking.last_name || "")}</h3><div class="booking-modal-grid"><div><span>Vehicle</span><strong>${esc(vehicleName(booking))}</strong></div><div><span>Status</span><strong>${esc(booking.status || "New")}</strong></div><div><span>Appointment date</span><strong>${esc(booking.preferred_date || "—")}</strong></div><div><span>Appointment time</span><strong>${esc(booking.preferred_time || "—")}</strong></div><div><span>Phone</span><a href="tel:${esc(booking.phone || "")}">${esc(booking.phone || "—")}</a></div><div><span>Email</span><a href="mailto:${esc(booking.email || "")}">${esc(booking.email || "—")}</a></div><div class="wide"><span>Submitted</span><strong>${esc(fmt(booking.created_at))}</strong></div><div class="wide"><span>Message / notes</span><strong>${esc(booking.message || booking.notes || booking.additional_info || "No additional message provided.")}</strong></div></div>`;
      modal.classList.remove("hidden");
    }

    function filteredRows() {
      const status = document.getElementById("bookingStatusSelect")?.value || "all";
      const dateFilter = document.getElementById("bookingDateSelect")?.value || "all";
      const query = (document.getElementById("bookingSearch")?.value || "").trim().toLowerCase();
      const from = document.getElementById("bookingDateFrom")?.value || "", to = document.getElementById("bookingDateTo")?.value || "";
      return bookings.filter(booking => {
        const date = dayKey(booking.preferred_date);
        if (status !== "all" && String(booking.status || "New").toLowerCase() !== status.toLowerCase()) return false;
        if (dateFilter !== "all" && dateCategory(booking) !== dateFilter) return false;
        if (from && (!date || date < from)) return false;
        if (to && (!date || date > to)) return false;
        if (query && !`${booking.first_name || ""} ${booking.last_name || ""} ${vehicleName(booking)} ${booking.phone || ""} ${booking.email || ""}`.toLowerCase().includes(query)) return false;
        return true;
      }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    function render() {
      const rows = filteredRows();
      if (!rows.length) { list.innerHTML = '<div class="booking-empty">No bookings match your filters.</div>'; return; }
      list.innerHTML = rows.map(booking => `<article class="booking-card"><div class="booking-main"><div class="booking-title-row"><div><span class="booking-status status-${String(booking.status || "New").toLowerCase()}">${esc(booking.status || "New")}</span><h4>${esc(booking.first_name || "")} ${esc(booking.last_name || "")}</h4></div><div class="booking-submitted">Requested ${fmt(booking.created_at)}</div></div><div class="booking-details"><div><span>Vehicle</span><strong>${esc(vehicleName(booking))}</strong></div><div><span>Preferred appointment</span><strong>${esc(booking.preferred_date || "—")} · ${esc(booking.preferred_time || "—")}</strong></div><div><span>Phone</span><a href="tel:${esc(booking.phone || "")}">${esc(booking.phone || "—")}</a></div><div><span>Email</span><a href="mailto:${esc(booking.email || "")}">${esc(booking.email || "—")}</a></div></div></div><div class="booking-actions"><button class="mini-btn" data-view-booking="${esc(booking.id)}" type="button">View</button><label>Status<select data-booking-status="${esc(booking.id)}"><option ${booking.status === "New" ? "selected" : ""}>New</option><option ${booking.status === "Confirmed" ? "selected" : ""}>Confirmed</option><option ${booking.status === "Completed" ? "selected" : ""}>Completed</option><option ${booking.status === "Cancelled" ? "selected" : ""}>Cancelled</option></select></label><button class="mini-btn" data-save-booking="${esc(booking.id)}" type="button">Save</button></div></article>`).join("");
      list.querySelectorAll("[data-view-booking]").forEach(button => button.addEventListener("click", () => { const booking = bookings.find(item => String(item.id) === String(button.dataset.viewBooking)); if (booking) openDetails(booking); }));
      list.querySelectorAll("[data-save-booking]").forEach(button => button.addEventListener("click", async () => {
        if (button.disabled) return;
        button.disabled = true;
        try {
          const id = button.dataset.saveBooking, status = list.querySelector(`[data-booking-status="${CSS.escape(id)}"]`).value;
          const { error } = await db.from("test_drive_bookings").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
          if (error) throw error;
          const booking = bookings.find(item => String(item.id) === String(id));
          if (booking) booking.status = status;
          toast("Booking updated."); render();
        } catch (error) { toast("Could not update booking: " + error.message); }
        finally { button.disabled = false; }
      }));
    }

    async function loadBookings() {
      if (loading || document.getElementById("adminView")?.classList.contains("hidden")) return;
      loading = true; list.innerHTML = '<div class="muted">Loading bookings…</div>';
      try {
        const { data, error } = await db.from("test_drive_bookings").select("*, Vehicles(Year,Make,Model)").order("created_at", { ascending: false });
        if (error) throw error;
        bookings = data || []; render();
      } catch (error) { console.error(error); list.innerHTML = `<div class="booking-empty">Could not load bookings: ${esc(error.message)}</div>`; }
      finally { loading = false; }
    }

    ["bookingSearch", "bookingStatusSelect", "bookingDateSelect", "bookingDateFrom", "bookingDateTo"].forEach(id => document.getElementById(id)?.addEventListener(id === "bookingSearch" ? "input" : "change", render));
    document.getElementById("clearBookingFilters")?.addEventListener("click", () => {
      document.getElementById("bookingSearch").value = ""; document.getElementById("bookingStatusSelect").value = "all"; document.getElementById("bookingDateSelect").value = "all"; document.getElementById("bookingDateFrom").value = ""; document.getElementById("bookingDateTo").value = ""; render();
    });
    document.getElementById("refreshBookingsBtn")?.addEventListener("click", loadBookings);
    window.loadBookings = loadBookings;
  }
  function start() { if (document.getElementById("bookingsList")) init(); else setTimeout(start, 100); }
  document.addEventListener("DOMContentLoaded", start);
  window.addEventListener("adminpanelsready", init);
})();
