(() => {
  const panel = document.getElementById("bookingAvailabilityAdmin");
  const form = document.getElementById("bookingAvailabilityForm");
  const rows = document.getElementById("bookingWeeklyRows");
  const status = document.getElementById("bookingAvailabilityStatus");
  if (!panel || !form || !rows) return;

  const db = window.__moAdminDb;
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const isAdmin = () => ["owner", "admin"].includes(window.moStaff?.role);
  const defaultDay = weekday => ({ weekday, is_open: weekday !== 0, booking_start: "12:00", booking_end: "18:00", slot_minutes: 30 });

  function rowMarkup(day) {
    const start = String(day.booking_start || "12:00").slice(0, 5);
    const end = String(day.booking_end || "18:00").slice(0, 5);
    return `<div class="booking-weekly-row" data-weekday="${day.weekday}">
      <strong>${days[day.weekday]}</strong>
      <label class="booking-day-toggle"><input type="checkbox" data-field="is_open" ${day.is_open ? "checked" : ""}><span>${day.is_open ? "Open" : "Closed"}</span></label>
      <label><span class="mobile-field-label">Starts</span><input type="time" data-field="booking_start" min="12:00" max="17:45" value="${start}" ${day.is_open ? "" : "disabled"} required></label>
      <label><span class="mobile-field-label">Ends</span><input type="time" data-field="booking_end" min="12:15" max="18:00" value="${end}" ${day.is_open ? "" : "disabled"} required></label>
      <label><span class="mobile-field-label">Spacing</span><select data-field="slot_minutes" ${day.is_open ? "" : "disabled"}><option value="15" ${Number(day.slot_minutes) === 15 ? "selected" : ""}>15 min</option><option value="30" ${Number(day.slot_minutes) === 30 ? "selected" : ""}>30 min</option><option value="60" ${Number(day.slot_minutes) === 60 ? "selected" : ""}>60 min</option></select></label>
    </div>`;
  }

  function render(schedule) {
    const byDay = new Map((schedule || []).map(day => [Number(day.weekday), day]));
    rows.innerHTML = days.map((_, weekday) => rowMarkup(byDay.get(weekday) || defaultDay(weekday))).join("");
  }

  rows.addEventListener("change", event => {
    if (!event.target.matches('[data-field="is_open"]')) return;
    const row = event.target.closest(".booking-weekly-row");
    const open = event.target.checked;
    row.querySelector(".booking-day-toggle span").textContent = open ? "Open" : "Closed";
    row.querySelectorAll('input[type="time"],select').forEach(control => { control.disabled = !open; });
  });

  async function load() {
    if (!isAdmin()) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    status.textContent = "Loading weekly booking hours…";
    const { data, error } = await db.from("booking_weekly_availability").select("*").order("weekday");
    if (error) {
      render([]);
      status.textContent = "Weekly booking hours could not be loaded.";
      return;
    }
    render(data);
    status.textContent = "";
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!isAdmin()) {
      status.textContent = "Administrator access required.";
      return;
    }
    const updates = [];
    for (const row of rows.querySelectorAll(".booking-weekly-row")) {
      const isOpen = row.querySelector('[data-field="is_open"]').checked;
      const start = row.querySelector('[data-field="booking_start"]').value;
      const end = row.querySelector('[data-field="booking_end"]').value;
      if (isOpen && (start < "12:00" || end > "18:00" || start >= end)) {
        status.textContent = `${days[Number(row.dataset.weekday)]} needs a valid time range between 12:00 PM and 6:00 PM.`;
        return;
      }
      updates.push({
        weekday: Number(row.dataset.weekday),
        is_open: isOpen,
        booking_start: start,
        booking_end: end,
        slot_minutes: Number(row.querySelector('[data-field="slot_minutes"]').value),
        updated_at: new Date().toISOString(),
        updated_by: window.moStaff.user_id
      });
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = "Saving weekly schedule…";
    const results = await Promise.all(updates.map(day =>
      db.from("booking_weekly_availability").update({
        is_open: day.is_open,
        booking_start: day.booking_start,
        booking_end: day.booking_end,
        slot_minutes: day.slot_minutes,
        updated_at: day.updated_at,
        updated_by: day.updated_by
      }).eq("weekday", day.weekday)
    ));
    const failure = results.find(result => result.error);
    status.textContent = failure ? `Could not save: ${failure.error.message}` : "Weekly booking schedule updated.";
    button.disabled = false;
  });

  window.loadBookingAvailabilitySettings = load;
  window.addEventListener("mostaffready", load);
  if (window.moStaff) load();
})();
