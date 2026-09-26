(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const isAdmin = () => ["owner","admin"].includes(window.moStaff?.role);
  let employees = [], schedules = [], timeOff = [], scheduleMode = "self";

  function addPanel() {
    if ($("staffSchedulePanel")) return;
    const panel = document.createElement("section");
    panel.id = "staffSchedulePanel";
    panel.className = "panel schedule-panel";
    panel.innerHTML = `<div class="panel-head"><div><span class="eyebrow">TEAM CALENDAR</span><h3>Employee schedule</h3><p class="muted">Review assigned shifts and record vacation or time away from work.</p></div><button id="refreshSchedule" class="secondary-btn" type="button">Refresh</button></div>
      <div class="schedule-toolbar"><label id="scheduleEmployeeLabel">Employee<select id="scheduleEmployee"></select></label><div id="scheduleHours" class="muted"></div></div>
      <div id="scheduleWeek" class="schedule-week"><div class="muted">Loading schedule…</div></div>
      <div id="scheduleAdminTools" class="schedule-admin-grid">
        <form id="scheduleShiftForm" class="schedule-form"><h4>Add recurring shift</h4><label>Employee<select id="shiftEmployee" required></select></label><label>Day<select id="shiftWeekday" required>${days.slice(1).concat(days[0]).map(day => `<option value="${days.indexOf(day)}">${day}</option>`).join("")}</select></label><label>Start time<input id="shiftStart" type="time" required value="12:00"></label><label>End time<input id="shiftEnd" type="time" required value="18:00"></label><label>Effective from<input id="shiftValidFrom" type="date" required></label><label>Effective until<input id="shiftValidUntil" type="date" required></label><label class="wide">Note<input id="shiftNote" placeholder="Optional schedule note"></label><button class="primary-btn" type="submit">Add Shift</button><p id="shiftStatus" class="status"></p></form>
        <form id="timeOffForm" class="time-off-form"><h4>Add vacation or time off</h4><label id="timeOffEmployeeLabel">Employee<select id="timeOffEmployee" required></select></label><label>Type<select id="timeOffType"><option value="vacation">Vacation</option><option value="time_off">Time off</option><option value="sick">Sick leave</option></select></label><label>First day<input id="timeOffStart" type="date" required></label><label>Last day<input id="timeOffEnd" type="date" required></label><label class="wide">Notes<textarea id="timeOffNotes" rows="3" placeholder="Reason or coverage notes"></textarea></label><button class="primary-btn" type="submit">${isAdmin() ? "Add Time Off" : "Request Time Off"}</button><p id="timeOffStatus" class="status"></p></form>
      </div>
      <div id="timeOffHeading" class="panel-head compact"><div><span class="eyebrow">TIME AWAY</span><h4>Vacation and time-off records</h4></div></div><div id="timeOffRows" class="payroll-table-wrap"><div class="muted payroll-empty">Loading time-off records…</div></div>`;
    $("adminView").appendChild(panel);
    if (!isAdmin()) $("scheduleAdminTools").remove();
  }

  const displayTime = value => new Date(`2000-01-01T${value}`).toLocaleTimeString("en-CA", {hour:"numeric",minute:"2-digit"});
  const hours = row => {
    const [sh,sm] = row.start_time.split(":").map(Number), [eh,em] = row.end_time.split(":").map(Number);
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  };

  function employeeOptions(select, selected) {
    select.innerHTML = employees.map(employee => `<option value="${esc(employee.user_id)}">${esc(employee.display_name)}</option>`).join("");
    if (employees.some(employee => employee.user_id === selected)) select.value = selected;
  }

  function render() {
    const adminMode = isAdmin() && scheduleMode === "admin";
    const employeeId = adminMode ? ($("scheduleEmployee").value || window.moStaff.user_id) : window.moStaff.user_id;
    const rows = schedules.filter(row => row.employee_id === employeeId);
    $("scheduleHours").textContent = `${rows.reduce((sum,row) => sum + hours(row), 0).toFixed(1)} scheduled hours per week`;
    $("scheduleWeek").innerHTML = days.slice(1).concat(days[0]).map(day => {
      const weekday = days.indexOf(day), shifts = rows.filter(row => row.weekday === weekday);
      return `<article class="schedule-day"><h4>${day}</h4>${shifts.length ? shifts.map(row => `<div class="schedule-shift"><strong>${displayTime(row.start_time)}–${displayTime(row.end_time)}</strong><small>${esc(row.valid_from)} to ${esc(row.valid_until)}</small>${row.note ? `<small>${esc(row.note)}</small>` : ""}${isAdmin() ? `<button class="schedule-remove" data-remove-shift="${esc(row.id)}" type="button" aria-label="Remove shift">×</button>` : ""}</div>`).join("") : '<span class="muted">Off</span>'}</article>`;
    }).join("");
    if (!adminMode) return;
    const relevant = timeOff.filter(row => row.employee_id === employeeId);
    $("timeOffRows").innerHTML = relevant.length ? `<table class="payroll-table"><thead><tr><th>Employee</th><th>Dates</th><th>Type</th><th>Status</th><th>Notes</th>${isAdmin() ? "<th>Actions</th>" : ""}</tr></thead><tbody>${relevant.map(row => `<tr><td>${esc(row.staff_members?.display_name || window.moStaff.display_name)}</td><td>${esc(row.start_date)} – ${esc(row.end_date)}</td><td>${esc(row.request_type.replace("_"," "))}</td><td><span class="schedule-status ${esc(row.status)}">${esc(row.status)}</span></td><td>${esc(row.notes || "—")}</td>${isAdmin() ? `<td><div class="time-off-actions">${row.status === "pending" ? `<button class="mini-btn" data-time-off-status="approved" data-time-off-id="${row.id}" type="button">Approve</button><button class="mini-btn" data-time-off-status="declined" data-time-off-id="${row.id}" type="button">Decline</button>` : ""}<button class="mini-btn danger" data-time-off-delete="${row.id}" type="button">Delete</button></div></td>` : ""}</tr>`).join("")}</tbody></table>` : '<div class="muted payroll-empty">No vacation or time-off records found.</div>';
  }

  async function load(mode = scheduleMode) {
    scheduleMode = mode;
    const adminMode = isAdmin() && scheduleMode === "admin";
    $("scheduleEmployeeLabel").classList.toggle("hidden", !adminMode);
    $("scheduleAdminTools")?.classList.toggle("hidden", !adminMode);
    $("timeOffHeading").classList.toggle("hidden", !adminMode);
    $("timeOffRows").classList.toggle("hidden", !adminMode);
    const memberQuery = adminMode ? db.from("staff_members").select("user_id,display_name").eq("active",true).order("display_name") : Promise.resolve({data:[{user_id:window.moStaff.user_id,display_name:window.moStaff.display_name}]});
    const [{data:members,error:memberError},{data:shiftRows,error:shiftError},{data:offRows,error:offError}] = await Promise.all([
      memberQuery,
      db.from("employee_schedules").select("*").order("weekday").order("start_time"),
      adminMode ? db.from("employee_time_off").select("*,staff_members!employee_time_off_employee_id_fkey(display_name)").order("start_date",{ascending:false}) : Promise.resolve({data:[]})
    ]);
    const error = memberError || shiftError || offError;
    if (error) { $("scheduleWeek").innerHTML = `<div class="muted">${esc(error.message)}</div>`; return; }
    employees = members || []; schedules = shiftRows || []; timeOff = offRows || [];
    const selected = $("scheduleEmployee").value || window.moStaff.user_id;
    employeeOptions($("scheduleEmployee"), selected);
    if (adminMode) { employeeOptions($("shiftEmployee"), selected); employeeOptions($("timeOffEmployee"), selected); }
    render();
  }

  async function addShift(event) {
    event.preventDefault();
    const status = $("shiftStatus"), row = { employee_id:$("shiftEmployee").value, weekday:Number($("shiftWeekday").value), start_time:$("shiftStart").value, end_time:$("shiftEnd").value, valid_from:$("shiftValidFrom").value, valid_until:$("shiftValidUntil").value, note:$("shiftNote").value.trim() || null };
    status.textContent = "Saving shift…";
    const {error} = await db.from("employee_schedules").insert(row);
    status.textContent = error ? error.message : "Shift added.";
    if (!error) await load();
  }

  async function addTimeOff(event) {
    event.preventDefault();
    const status = $("timeOffStatus"), row = { employee_id:isAdmin() ? $("timeOffEmployee").value : window.moStaff.user_id, request_type:$("timeOffType").value, start_date:$("timeOffStart").value, end_date:$("timeOffEnd").value, notes:$("timeOffNotes").value.trim() || null, status:isAdmin() ? "approved" : "pending" };
    status.textContent = isAdmin() ? "Saving time off…" : "Sending request…";
    const {error} = await db.from("employee_time_off").insert(row);
    status.textContent = error ? error.message : isAdmin() ? "Time off added." : "Time-off request submitted.";
    if (!error) { event.currentTarget.reset(); await load(); }
  }

  async function rowAction(event) {
    const shift = event.target.closest("[data-remove-shift]");
    if (shift) { if (!confirm("Remove this recurring shift?")) return; const {error}=await db.from("employee_schedules").delete().eq("id",shift.dataset.removeShift); if (error) toast(error.message); else await load(); return; }
    const statusButton = event.target.closest("[data-time-off-status]");
    if (statusButton) { const {error}=await db.from("employee_time_off").update({status:statusButton.dataset.timeOffStatus,reviewed_by:window.moStaff.user_id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",statusButton.dataset.timeOffId); if (error) toast(error.message); else await load(); return; }
    const remove = event.target.closest("[data-time-off-delete]");
    if (remove && confirm("Delete this time-off record?")) { const {error}=await db.from("employee_time_off").delete().eq("id",remove.dataset.timeOffDelete); if (error) toast(error.message); else await load(); }
  }

  function init() {
    addPanel();
    const today = new Date().toISOString().slice(0,10);
    if ($("shiftValidFrom")) { $("shiftValidFrom").value = today; $("shiftValidUntil").value = today; }
    $("refreshSchedule").addEventListener("click", load);
    $("scheduleEmployee").addEventListener("change", () => { if ($("shiftEmployee")) $("shiftEmployee").value=$("scheduleEmployee").value; if ($("timeOffEmployee")) $("timeOffEmployee").value=$("scheduleEmployee").value; render(); });
    $("scheduleShiftForm")?.addEventListener("submit", addShift);
    $("timeOffForm")?.addEventListener("submit", addTimeOff);
    $("staffSchedulePanel").addEventListener("click", rowAction);
    window.loadStaffSchedule = load;
  }
  window.addEventListener("mostaffready", init, {once:true});
  if (window.moStaff) init();
})();
