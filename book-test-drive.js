const { U, H, fallback, loadSettings, createSlots, settingsForDate } = window.moBookingAvailability;
const sel = document.getElementById("vehicle");
const dateInput = document.getElementById("date");
const timeSelect = document.getElementById("time");
const msg = document.getElementById("formMessage");
const emailNote = document.getElementById("formEmailNote");
const form = document.getElementById("testDriveForm");
const params = new URLSearchParams(location.search);
let weeklySchedule = fallback;
let slots = [];

const localDateISO = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split("T")[0];
};
dateInput.min = localDateISO();

function resetTimes(text = "Select a date first") {
  timeSelect.innerHTML = `<option value="">${text}</option>`;
  timeSelect.disabled = true;
}

function slotIsPast(slot, date) {
  if (date !== localDateISO()) return false;
  const now = new Date();
  const match = slot.match(/^(\d{1,2}):(\d{2}) (AM|PM)$/i);
  if (!match) return false;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (match[3].toUpperCase() === "PM" && hours !== 12) hours += 12;
  if (match[3].toUpperCase() === "AM" && hours === 12) hours = 0;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes) <= now;
}

function renderTimes(booked = [], date = dateInput.value) {
  timeSelect.innerHTML = '<option value="">Select a time</option>';
  slots.forEach(slot => {
    const option = document.createElement("option");
    const unavailable = booked.includes(slot);
    const past = slotIsPast(slot, date);
    option.value = slot;
    option.disabled = unavailable || past;
    option.textContent = unavailable ? `${slot} — Unavailable` : past ? `${slot} — Past` : slot;
    timeSelect.appendChild(option);
  });
  timeSelect.disabled = false;
}

async function loadAvailability() {
  const date = dateInput.value;
  if (!date) return resetTimes();
  const daySettings = settingsForDate(weeklySchedule, date);
  if (!daySettings.is_open) {
    resetTimes("Closed this day");
    msg.textContent = "Online appointments are closed on this day. Please choose another date.";
    if (emailNote) emailNote.hidden = true;
    return;
  }
  slots = createSlots(daySettings);
  msg.textContent = "Checking available times…";
  resetTimes("Loading available times…");
  try {
    const response = await fetch(`${U}/rest/v1/rpc/get_test_drive_booked_times`, { method: "POST", headers: H, body: JSON.stringify({ p_date: date }) });
    if (!response.ok) throw new Error();
    const data = await response.json();
    renderTimes(data.map(row => row.preferred_time), date);
    msg.textContent = `Choose an available ${daySettings.slot_minutes}-minute appointment time.`;
  } catch {
    renderTimes([], date);
    msg.textContent = "We couldn't check existing bookings, so please choose a time and we'll confirm availability.";
  }
}

async function initialize() {
  weeklySchedule = await loadSettings();
  try {
    const response = await fetch(`${U}/rest/v1/Vehicles?select=*&order=created_at.desc`, { headers: H });
    const rows = await response.json();
    rows.filter(vehicle => ["available", "in stock", "active", "coming soon"].includes(String(vehicle.Status || "Available").toLowerCase())).forEach(vehicle => {
      const option = document.createElement("option");
      option.value = vehicle.id;
      option.textContent = `${vehicle.Year} ${vehicle.Make} ${vehicle.Model}`;
      if (params.get("vehicle") === String(vehicle.id)) option.selected = true;
      sel.appendChild(option);
    });
  } catch {
    msg.textContent = "We couldn't load the vehicle list. You can still book a time without selecting a vehicle.";
  }
  if (dateInput.value) loadAvailability();
}

dateInput.addEventListener("change", loadAvailability);
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (emailNote) emailNote.hidden = true;
  const hasVehicle = Boolean(sel.value);
  const payload = {
    vehicle_id: hasVehicle ? Number(sel.value) : null,
    vehicle_name: hasVehicle ? sel.options[sel.selectedIndex]?.textContent : null,
    preferred_date: dateInput.value,
    preferred_time: timeSelect.value,
    first_name: document.getElementById("firstName").value.trim(),
    last_name: document.getElementById("lastName").value.trim() || null,
    phone: document.getElementById("phone").value.trim() || null,
    email: document.getElementById("email").value.trim() || null
  };
  if (!payload.preferred_time) {
    msg.textContent = "Please choose an available appointment time.";
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  msg.textContent = "Booking your appointment…";
  try {
    const response = await fetch(`${U}/rest/v1/test_drive_bookings`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(payload) });
    if (response.status === 409) {
      await loadAvailability();
      throw new Error("That time was just booked. Please choose another available time.");
    }
    if (!response.ok) {
      let detail = "Unable to save booking";
      try { const body = await response.json(); detail = body?.message || body?.error?.message || body?.hint || detail; } catch {}
      throw new Error(detail);
    }
    const notify = await fetch(`${U}/functions/v1/lead-notification`, { method: "POST", headers: H, body: JSON.stringify({ type: "test_drive", data: payload }) });
    msg.textContent = notify.ok ? "You're booked! If you provided an email, a confirmation has been sent." : "You're booked! Your request was saved and we'll follow up with you.";
    if (notify.ok && payload.email && emailNote) emailNote.hidden = false;
    form.reset();
    dateInput.min = localDateISO();
    resetTimes();
  } catch (error) {
    msg.textContent = error.message || "We couldn't submit your request. Please try again or call M.O Motors.";
  } finally {
    button.disabled = false;
  }
});

initialize();
