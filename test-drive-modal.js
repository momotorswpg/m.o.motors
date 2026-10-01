(() => {
  const { U, H, fallback, loadSettings, createSlots, settingsForDate } = window.moBookingAvailability;
  const modal = document.createElement("div");
  modal.className = "test-drive-modal";
  modal.hidden = true;
  modal.innerHTML = `<div class="test-drive-backdrop" data-close></div><div class="test-drive-dialog" role="dialog" aria-modal="true" aria-labelledby="testDriveTitle"><button class="test-drive-close" type="button" aria-label="Close" data-close>×</button><p class="eyebrow red">BOOK A TEST DRIVE</p><h2 id="testDriveTitle">Let's get you behind the wheel.</h2><form id="modalTestDriveForm" class="modal-test-drive-form"><label>Vehicle <span class="optional-label">(optional)</span><select id="modalVehicle"><option value="">No specific vehicle yet</option></select></label><div class="modal-form-grid"><label>Preferred date<input id="modalDate" type="date" required></label><label>Preferred time<select id="modalTime" required disabled><option value="">Select a date first</option></select></label><label>First name<input id="modalFirstName" required></label><label>Last name <span class="optional-label">(optional)</span><input id="modalLastName"></label><label>Phone <span class="optional-label">(optional)</span><input id="modalPhone" type="tel"></label><label>Email <span class="optional-label">(optional)</span><input id="modalEmail" type="email"></label></div><div class="test-drive-contact compact" aria-label="M.O. Motors contact information"><div><div class="contact-item-content"><span class="contact-label">Visit us</span><span class="contact-value">Unit 104, 420 Des Meurons St, Winnipeg, MB R2H 2N9</span></div></div><div><div class="contact-item-content"><span class="contact-label">Call us</span><a class="contact-value" href="tel:+12049634462">204-963-4462</a></div></div><div><div class="contact-item-content"><span class="contact-label">Hours</span><span class="contact-value">Mon–Sat: 12 PM–6 PM</span></div></div></div><button class="btn btn-primary" type="submit">Request Test Drive</button><p id="modalTestDriveMessage" class="muted-copy" aria-live="polite"></p><p id="modalTestDriveEmailNote" class="test-drive-email-note" aria-live="polite" hidden>We've sent your confirmation to your email. Please check your inbox, and your Junk or Spam folder if you don't see it.</p></form></div>`;
  document.body.appendChild(modal);

  const style = document.createElement("style");
  style.textContent = `.optional-label{color:#777;font-size:10px;font-weight:500;text-transform:none;letter-spacing:0}.test-drive-contact{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 16px;margin:2px 0 0;padding:13px 0;border-top:1px solid #e1e2e5;border-bottom:1px solid #e1e2e5}.test-drive-contact .contact-label{display:block;color:#d71920;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px}.test-drive-contact span.contact-value,.test-drive-contact a.contact-value{font-size:13px;line-height:1.4;color:#202124;text-decoration:none;font-weight:800;overflow-wrap:anywhere}.test-drive-contact .contact-item-content{display:flex;flex-direction:column;gap:4px}.test-drive-email-note{margin:3px 0 0;font-size:11px;line-height:1.45;color:#777;font-weight:400}@media(max-width:560px){.test-drive-contact{grid-template-columns:1fr;gap:12px;padding:14px 0}.test-drive-contact span.contact-value,.test-drive-contact a.contact-value{font-size:12px}}`;
  document.head.appendChild(style);

  const form = modal.querySelector("form");
  const vehicleSelect = modal.querySelector("#modalVehicle");
  const dateInput = modal.querySelector("#modalDate");
  const timeSelect = modal.querySelector("#modalTime");
  const message = modal.querySelector("#modalTestDriveMessage");
  const emailNote = modal.querySelector("#modalTestDriveEmailNote");
  let loaded = false;
  let weeklySchedule = fallback;
  let slots = [];
  const localDateISO = () => {
    const date = new Date();
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
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
      message.textContent = "Online appointments are closed on this day. Please choose another date.";
      return;
    }
    slots = createSlots(daySettings);
    message.textContent = "Checking available times…";
    resetTimes("Loading available times…");
    try {
      const response = await fetch(`${U}/rest/v1/rpc/get_test_drive_booked_times`, { method: "POST", headers: H, body: JSON.stringify({ p_date: date }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      renderTimes(data.map(row => row.preferred_time), date);
      message.textContent = `Choose an available ${daySettings.slot_minutes}-minute appointment time.`;
    } catch {
      renderTimes([], date);
      message.textContent = "We couldn't check existing bookings, so please choose a time and we'll confirm availability.";
    }
  }

  async function loadVehicles(selected) {
    try {
      if (!loaded) {
        const [settings, response] = await Promise.all([loadSettings(), fetch(`${U}/rest/v1/Vehicles?select=*&order=created_at.desc`, { headers: H })]);
        weeklySchedule = settings;
        if (!response.ok) throw new Error();
        const rows = await response.json();
        rows.filter(vehicle => ["available", "in stock", "active", "coming soon"].includes(String(vehicle.Status || "Available").toLowerCase())).forEach(vehicle => {
          const option = document.createElement("option");
          option.value = vehicle.id;
          option.textContent = `${vehicle.Year || ""} ${vehicle.Make || ""} ${vehicle.Model || ""}`.trim();
          vehicleSelect.appendChild(option);
        });
        loaded = true;
      }
      if (selected) vehicleSelect.value = selected;
      if (dateInput.value) await loadAvailability();
    } catch {
      weeklySchedule = fallback;
      message.textContent = "We couldn't load the vehicle list. You can still book a time without selecting a vehicle.";
    }
  }

  async function open(vehicleId) {
    message.textContent = "";
    emailNote.hidden = true;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    await loadVehicles(vehicleId);
  }
  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  document.addEventListener("click", event => {
    const link = event.target.closest('a[href*="book-test-drive.html"]');
    if (link) {
      event.preventDefault();
      open(new URL(link.href, location.href).searchParams.get("vehicle"));
    }
    if (event.target.matches("[data-close]")) close();
  });
  dateInput.addEventListener("change", loadAvailability);

  form.addEventListener("submit", async event => {
    event.preventDefault();
    emailNote.hidden = true;
    const hasVehicle = Boolean(vehicleSelect.value);
    const payload = {
      vehicle_id: hasVehicle ? Number(vehicleSelect.value) : null,
      vehicle_name: hasVehicle ? vehicleSelect.options[vehicleSelect.selectedIndex]?.textContent : null,
      preferred_date: dateInput.value,
      preferred_time: timeSelect.value,
      first_name: modal.querySelector("#modalFirstName").value.trim(),
      last_name: modal.querySelector("#modalLastName").value.trim() || null,
      phone: modal.querySelector("#modalPhone").value.trim() || null,
      email: modal.querySelector("#modalEmail").value.trim() || null
    };
    if (!payload.preferred_time) {
      message.textContent = "Please choose an available appointment time.";
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message.textContent = "Booking your appointment…";
    try {
      const response = await fetch(`${U}/rest/v1/test_drive_bookings`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(payload) });
      if (response.status === 409) {
        await loadAvailability();
        throw new Error("That time was just booked. Please choose another available time.");
      }
      if (!response.ok) throw new Error("Unable to save booking");
      const notify = await fetch(`${U}/functions/v1/lead-notification`, { method: "POST", headers: H, body: JSON.stringify({ type: "test_drive", data: payload }) });
      message.textContent = notify.ok ? "You're booked! If you provided an email, a confirmation has been sent." : "You're booked! Your request was saved and we'll follow up with you.";
      if (notify.ok && payload.email) emailNote.hidden = false;
      form.reset();
      dateInput.min = localDateISO();
      resetTimes();
    } catch (error) {
      message.textContent = error.message || "We couldn't submit your request. Please try again or call M.O Motors.";
    } finally {
      button.disabled = false;
    }
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) close(); });
})();
