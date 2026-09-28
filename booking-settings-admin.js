(() => {
  const panel = document.getElementById("bookingAvailabilityAdmin");
  const form = document.getElementById("bookingAvailabilityForm");
  const start = document.getElementById("bookingStart");
  const end = document.getElementById("bookingEnd");
  const interval = document.getElementById("bookingInterval");
  const status = document.getElementById("bookingAvailabilityStatus");
  if (!panel || !form) return;

  const db = window.__moAdminDb;
  const isAdmin = () => ["owner", "admin"].includes(window.moStaff?.role);

  async function load() {
    if (!isAdmin()) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    status.textContent = "Loading booking hours…";
    const { data, error } = await db.from("booking_settings").select("booking_start,booking_end,slot_minutes").eq("id", 1).single();
    if (error) {
      status.textContent = "Booking hours could not be loaded.";
      return;
    }
    start.value = String(data.booking_start).slice(0, 5);
    end.value = String(data.booking_end).slice(0, 5);
    interval.value = String(data.slot_minutes);
    status.textContent = "";
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!isAdmin()) {
      status.textContent = "Administrator access required.";
      return;
    }
    if (start.value < "12:00" || end.value > "18:00" || start.value >= end.value) {
      status.textContent = "Choose a valid range between 12:00 PM and 6:00 PM.";
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = "Saving…";
    const { error } = await db.from("booking_settings").update({
      booking_start: start.value,
      booking_end: end.value,
      slot_minutes: Number(interval.value),
      updated_at: new Date().toISOString(),
      updated_by: window.moStaff.user_id
    }).eq("id", 1);
    status.textContent = error ? `Could not save: ${error.message}` : "Booking availability updated.";
    button.disabled = false;
  });

  window.loadBookingAvailabilitySettings = load;
  window.addEventListener("mostaffready", load);
  if (window.moStaff) load();
})();
