(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
  const cash = value => new Intl.NumberFormat("en-CA", { style:"currency", currency:"CAD" }).format(Number(value) || 0);
  const stamp = value => value ? new Date(value).toLocaleString("en-CA", { dateStyle:"medium", timeStyle:"short" }) : "Open";
  const hoursBetween = row => {
    const end = row.clock_out ? new Date(row.clock_out) : new Date();
    return Math.max(0, ((end - new Date(row.clock_in)) / 3600000) - ((Number(row.break_minutes) || 0) / 60));
  };
  let currentUser = null;
  let staff = [];
  let employeeDirectory = [];
  let payrollShifts = [];
  let commissions = [];

  function addPanels() {
    const admin = $("adminView");
    if (!admin || document.querySelector(".timesheet-panel")) return;
    const timesheet = document.createElement("section");
    timesheet.className = "panel timesheet-panel";
    timesheet.innerHTML = `<div class="panel-head"><div><span class="eyebrow">MY TIMESHEET</span><h3>Clock in and out</h3><p class="muted">Record your workday electronically. Times are saved in Winnipeg time.</p></div><button id="refreshTimesheet" class="secondary-btn" type="button">Refresh</button></div>
      <div class="clock-card"><div><span id="clockStateLabel" class="eyebrow">CURRENT STATUS</span><strong id="clockState">Checking…</strong><small id="clockStarted"></small></div><button id="clockAction" class="primary-btn" type="button" disabled>Clock In</button></div>
      <div class="panel-head compact"><div><span class="eyebrow">RECENT SHIFTS</span><h4>Your recorded time</h4></div></div><div id="myTimesheetRows" class="payroll-table-wrap"><div class="muted">Loading timesheet…</div></div>`;
    admin.appendChild(timesheet);

    const employees = document.createElement("section");
    employees.className = "panel employees-panel";
    employees.innerHTML = `<div class="panel-head"><div><span class="eyebrow">ADMIN · EMPLOYEES</span><h3>Employee accounts</h3><p class="muted">Invite staff, control access, update email addresses and send secure password-reset links.</p></div><button id="refreshEmployees" class="secondary-btn" type="button">Refresh</button></div>
      <form id="employeeInviteForm"><div class="employee-invite-grid"><label>Employee name<input id="inviteEmployeeName" autocomplete="name" required></label><label>Email address<input id="inviteEmployeeEmail" type="email" autocomplete="email" required></label><label>Access level<select id="inviteEmployeeRole"><option value="sales">Sales</option><option value="admin">Admin</option></select></label><label>Hourly wage<input id="inviteEmployeeWage" type="number" min="0" step="0.01" value="0"></label><button class="primary-btn" type="submit">Send Invitation</button></div><p id="employeeInviteStatus" class="status"></p></form>
      <div class="panel-head compact"><div><span class="eyebrow">TEAM ACCESS</span><h4>Current employees</h4></div></div><div id="employeeAdminList" class="payroll-table-wrap"><div class="muted payroll-empty">Loading employees…</div></div>`;
    admin.appendChild(employees);

    const payroll = document.createElement("section");
    payroll.className = "panel payroll-panel";
    payroll.innerHTML = `<div class="panel-head"><div><span class="eyebrow">ADMIN · PAYROLL</span><h3>Employees and biweekly pay</h3><p class="muted">Review time, set hourly wages, record commissions and create printable pay stubs.</p></div><button id="refreshPayroll" class="secondary-btn" type="button">Refresh</button></div>
      <div class="payroll-grid">
        <section class="payroll-card"><h4>Employee pay settings</h4><label>Employee<select id="payrollEmployee"></select></label><label>Hourly wage (CAD)<input id="payrollWage" type="number" min="0" step="0.01"></label><button id="savePayrollWage" class="secondary-btn" type="button">Save Wage</button><p id="payrollWageStatus" class="status"></p></section>
        <section class="payroll-card"><h4>Add commission</h4><label>Date earned<input id="commissionDate" type="date"></label><label>Description<input id="commissionDescription" placeholder="Vehicle sale or bonus"></label><label>Amount (CAD)<input id="commissionAmount" type="number" min="0" step="0.01"></label><button id="addCommission" class="secondary-btn" type="button">Add Commission</button><p id="commissionStatus" class="status"></p></section>
      </div>
      <section class="payroll-period"><div class="panel-head compact"><div><span class="eyebrow">BIWEEKLY PERIOD</span><h4>Pay stub builder</h4></div></div><div class="payroll-period-fields"><label>Period start<input id="payPeriodStart" type="date"></label><label>Period end<input id="payPeriodEnd" type="date"></label><label>Other earnings<input id="payOtherEarnings" type="number" min="0" step="0.01" value="0"></label><label>Deductions<input id="payDeductions" type="number" min="0" step="0.01" value="0"></label></div><div class="form-actions"><button id="calculatePayroll" class="secondary-btn" type="button">Calculate</button><button id="savePayStub" class="primary-btn" type="button">Save Pay Stub</button><button id="printPayStub" class="secondary-btn" type="button">Print / Save PDF</button></div><p class="finance-note">Deductions are entered manually. This tool does not calculate CRA payroll deductions.</p><div id="payStubPreview" class="pay-stub-preview"><div class="muted">Choose an employee and period, then calculate.</div></div></section>
      <div class="panel-head compact"><div><span class="eyebrow">EMPLOYEE TIME</span><h4>Recorded shifts</h4></div></div><div id="adminTimesheetRows" class="payroll-table-wrap"></div>
      <div class="panel-head compact"><div><span class="eyebrow">SAVED RECORDS</span><h4>Pay stubs</h4></div></div><div id="savedPayStubs" class="payroll-table-wrap"></div>`;
    admin.appendChild(payroll);
  }

  function table(rows, admin = false) {
    if (!rows.length) return '<div class="muted payroll-empty">No time entries found.</div>';
    return `<table class="payroll-table"><thead><tr>${admin ? "<th>Employee</th>" : ""}<th>Clock in</th><th>Clock out</th><th>Break</th><th>Hours</th></tr></thead><tbody>${rows.map(row => `<tr>${admin ? `<td>${esc(row.staff_members?.display_name || "Employee")}</td>` : ""}<td>${esc(stamp(row.clock_in))}</td><td>${esc(stamp(row.clock_out))}</td><td>${Number(row.break_minutes)||0} min</td><td>${hoursBetween(row).toFixed(2)}</td></tr>`).join("")}</tbody></table>`;
  }

  async function loadMyTimesheet() {
    if (!currentUser) return;
    const { data, error } = await db.from("employee_timesheets").select("*").eq("employee_id", currentUser.id).order("clock_in", { ascending:false }).limit(30);
    if (error) { $("myTimesheetRows").innerHTML = `<div class="muted">${esc(error.message)}</div>`; return; }
    const rows = data || [], open = rows.find(row => !row.clock_out), button = $("clockAction");
    $("clockState").textContent = open ? "Clocked in" : "Clocked out";
    $("clockStarted").textContent = open ? `Started ${stamp(open.clock_in)}` : "Ready for your next shift";
    button.textContent = open ? "Clock Out" : "Clock In";
    button.dataset.shiftId = open?.id || "";
    button.disabled = false;
    $("myTimesheetRows").innerHTML = table(rows);
  }

  async function clockAction() {
    const button = $("clockAction");
    button.disabled = true;
    const shiftId = button.dataset.shiftId;
    const response = shiftId
      ? await db.from("employee_timesheets").update({ clock_out:new Date().toISOString(), updated_at:new Date().toISOString() }).eq("id", shiftId).is("clock_out", null)
      : await db.from("employee_timesheets").insert({ employee_id:currentUser.id });
    if (response.error) toast("Could not update timesheet: " + response.error.message);
    else toast(shiftId ? "You are clocked out." : "You are clocked in.");
    await loadMyTimesheet();
  }

  function defaultPeriod() {
    const end = new Date(), start = new Date();
    start.setDate(end.getDate() - 13);
    const local = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
    $("payPeriodStart").value ||= local(start);
    $("payPeriodEnd").value ||= local(end);
    $("commissionDate").value ||= local(end);
  }

  async function loadPayrollAdmin() {
    if (!["owner","admin"].includes(window.moStaff?.role)) return;
    const [{ data:members, error:membersError }, { data:shifts, error:shiftError }, { data:commissionRows, error:commissionError }, { data:stubs, error:stubError }] = await Promise.all([
      db.from("staff_members").select("user_id,display_name,email,role,active,hourly_wage").order("display_name"),
      db.from("employee_timesheets").select("*,staff_members!employee_timesheets_employee_id_fkey(display_name)").order("clock_in", { ascending:false }).limit(200),
      db.from("employee_commissions").select("*").order("earned_on", { ascending:false }).limit(200),
      db.from("pay_stubs").select("*,staff_members!pay_stubs_employee_id_fkey(display_name)").order("period_end", { ascending:false }).limit(100)
    ]);
    const error = membersError || shiftError || commissionError || stubError;
    if (error) { toast("Could not load payroll: " + error.message); return; }
    staff = (members || []).filter(member => member.active);
    payrollShifts = shifts || [];
    commissions = commissionRows || [];
    const select = $("payrollEmployee"), selected = select.value;
    select.innerHTML = staff.map(member => `<option value="${esc(member.user_id)}">${esc(member.display_name)} · ${member.role === "sales" ? "Sales" : "Admin"}</option>`).join("");
    if (staff.some(member => member.user_id === selected)) select.value = selected;
    syncEmployee();
    $("adminTimesheetRows").innerHTML = table(payrollShifts, true);
    $("savedPayStubs").innerHTML = stubs?.length ? `<table class="payroll-table"><thead><tr><th>Employee</th><th>Period</th><th>Hours</th><th>Gross</th><th>Net</th></tr></thead><tbody>${stubs.map(stub => `<tr><td>${esc(stub.staff_members?.display_name)}</td><td>${esc(stub.period_start)} – ${esc(stub.period_end)}</td><td>${Number(stub.regular_hours).toFixed(2)}</td><td>${cash(stub.gross_pay)}</td><td>${cash(stub.net_pay)}</td></tr>`).join("")}</tbody></table>` : '<div class="muted payroll-empty">No saved pay stubs yet.</div>';
    calculatePayroll();
  }

  async function invokeEmployeeAction(action, payload = {}) {
    const { data, error } = await db.functions.invoke("staff-user-admin", { body:{ action, ...payload } });
    if (error) {
      let message = data?.error || error.message;
      try { message = (await error.context?.json())?.error || message; } catch {}
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }

  function renderEmployees(rows) {
    const currentId = currentUser?.id;
    $("employeeAdminList").innerHTML = rows.length ? rows.map(member => {
      const self = member.user_id === currentId, owner = member.role === "owner";
      return `<article class="employee-editor" data-employee="${esc(member.user_id)}"><label>Name<input data-field="display_name" value="${esc(member.display_name)}"></label><label>Email<input data-field="email" type="email" value="${esc(member.email || "")}"></label><label>Access<select data-field="role" ${owner ? "disabled" : ""}><option value="sales" ${member.role === "sales" ? "selected" : ""}>Sales</option><option value="admin" ${member.role !== "sales" ? "selected" : ""}>Admin</option></select></label><label>Hourly wage<input data-field="hourly_wage" type="number" min="0" step="0.01" value="${Number(member.hourly_wage || 0).toFixed(2)}"></label><div class="employee-actions"><span class="employee-state ${member.active ? "" : "inactive"}">${member.active ? "Active" : "Inactive"}</span><button class="mini-btn" type="button" data-employee-save>Save</button><button class="mini-btn" type="button" data-employee-reset>Reset Password</button><button class="mini-btn ${member.active ? "danger" : ""}" type="button" data-employee-toggle ${self ? "disabled title=\"You cannot deactivate your own account\"" : ""}>${member.active ? "Deactivate" : "Reactivate"}</button></div></article>`;
    }).join("") : '<div class="muted payroll-empty">No employee accounts found.</div>';
  }

  async function loadEmployeeAdmin() {
    if (!["owner","admin"].includes(window.moStaff?.role)) return;
    const { data, error } = await db.from("staff_members").select("user_id,display_name,email,role,active,hourly_wage").order("display_name");
    if (error) { $("employeeAdminList").innerHTML = `<div class="muted payroll-empty">${esc(error.message)}</div>`; return; }
    employeeDirectory = data || [];
    renderEmployees(employeeDirectory);
  }

  async function inviteEmployee(event) {
    event.preventDefault();
    const status = $("employeeInviteStatus"), button = event.currentTarget.querySelector("button[type=submit]");
    status.textContent = "Sending secure invitation…"; button.disabled = true;
    try {
      const result = await invokeEmployeeAction("invite", { display_name:$("inviteEmployeeName").value.trim(), email:$("inviteEmployeeEmail").value.trim(), role:$("inviteEmployeeRole").value, hourly_wage:Number($("inviteEmployeeWage").value || 0) });
      status.textContent = result.message; event.currentTarget.reset(); $("inviteEmployeeRole").value = "sales"; $("inviteEmployeeWage").value = "0"; await loadEmployeeAdmin(); await loadPayrollAdmin();
    } catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
  }

  async function employeeListAction(event) {
    const button = event.target.closest("button"), card = event.target.closest("[data-employee]");
    if (!button || !card) return;
    const member = employeeDirectory.find(item => item.user_id === card.dataset.employee);
    if (!member) return;
    button.disabled = true;
    try {
      if (button.hasAttribute("data-employee-reset")) {
        const result = await invokeEmployeeAction("reset_password", { user_id:member.user_id });
        toast(result.message);
      } else {
        const active = button.hasAttribute("data-employee-toggle") ? !member.active : member.active;
        if (button.hasAttribute("data-employee-toggle") && member.active && !confirm(`Deactivate ${member.display_name}? They will no longer be able to sign in.`)) return;
        const result = await invokeEmployeeAction("update", { user_id:member.user_id, display_name:card.querySelector('[data-field="display_name"]').value.trim(), email:card.querySelector('[data-field="email"]').value.trim(), role:card.querySelector('[data-field="role"]').value, hourly_wage:Number(card.querySelector('[data-field="hourly_wage"]').value || 0), active });
        toast(result.message); await loadEmployeeAdmin(); await loadPayrollAdmin();
      }
    } catch (error) { toast("Employee update failed: " + error.message); } finally { button.disabled = false; }
  }

  function syncEmployee() {
    const member = staff.find(item => item.user_id === $("payrollEmployee").value);
    $("payrollWage").value = member?.hourly_wage ?? 0;
  }

  function payrollData() {
    const employeeId = $("payrollEmployee").value, member = staff.find(item => item.user_id === employeeId);
    const start = $("payPeriodStart").value, end = $("payPeriodEnd").value;
    const from = new Date(`${start}T00:00:00`), through = new Date(`${end}T23:59:59.999`);
    const shiftRows = payrollShifts.filter(row => row.employee_id === employeeId && new Date(row.clock_in) >= from && new Date(row.clock_in) <= through && row.clock_out);
    const regularHours = shiftRows.reduce((sum, row) => sum + hoursBetween(row), 0);
    const commissionRows = commissions.filter(row => row.employee_id === employeeId && row.earned_on >= start && row.earned_on <= end);
    const commissionEarnings = commissionRows.reduce((sum,row) => sum + Number(row.amount || 0), 0);
    const hourlyWage = Number(member?.hourly_wage || 0), hourlyEarnings = regularHours * hourlyWage;
    const otherEarnings = Number($("payOtherEarnings").value || 0), deductions = Number($("payDeductions").value || 0);
    const grossPay = hourlyEarnings + commissionEarnings + otherEarnings;
    return { employee_id:employeeId, employeeName:member?.display_name || "Employee", period_start:start, period_end:end, regular_hours:Number(regularHours.toFixed(2)), hourly_wage:hourlyWage, hourly_earnings:Number(hourlyEarnings.toFixed(2)), commission_earnings:Number(commissionEarnings.toFixed(2)), other_earnings:otherEarnings, deductions, gross_pay:Number(grossPay.toFixed(2)), net_pay:Number((grossPay-deductions).toFixed(2)) };
  }

  function calculatePayroll() {
    if (!$("payrollEmployee")?.value || !$("payPeriodStart").value || !$("payPeriodEnd").value) return;
    const pay = payrollData();
    $("payStubPreview").innerHTML = `<div class="pay-stub" id="printablePayStub"><div class="pay-stub-head"><div><span class="eyebrow">M.O MOTORS</span><h3>Biweekly Pay Stub</h3><p>Unit 104, 420 Des Meurons St, Winnipeg, MB R2H 2N9</p></div><div><span>Pay period</span><strong>${esc(pay.period_start)} – ${esc(pay.period_end)}</strong></div></div><div class="pay-stub-employee"><span>Employee</span><strong>${esc(pay.employeeName)}</strong></div><table><tbody><tr><th>Regular hours</th><td>${pay.regular_hours.toFixed(2)}</td></tr><tr><th>Hourly wage</th><td>${cash(pay.hourly_wage)}</td></tr><tr><th>Hourly earnings</th><td>${cash(pay.hourly_earnings)}</td></tr><tr><th>Commissions</th><td>${cash(pay.commission_earnings)}</td></tr><tr><th>Other earnings</th><td>${cash(pay.other_earnings)}</td></tr><tr class="total"><th>Gross pay</th><td>${cash(pay.gross_pay)}</td></tr><tr><th>Deductions</th><td>− ${cash(pay.deductions)}</td></tr><tr class="total"><th>Net pay</th><td>${cash(pay.net_pay)}</td></tr></tbody></table><small>Payroll deductions are administrator-entered. Verify this statement against payroll records before issuing payment.</small></div>`;
    return pay;
  }

  async function saveWage() {
    const member = staff.find(item => item.user_id === $("payrollEmployee").value), wage = Number($("payrollWage").value);
    const { error } = await db.from("staff_members").update({ hourly_wage:wage, updated_at:new Date().toISOString() }).eq("user_id", member.user_id);
    $("payrollWageStatus").textContent = error ? error.message : "Hourly wage saved.";
    if (!error) { member.hourly_wage = wage; calculatePayroll(); }
  }

  async function addCommission() {
    const description = $("commissionDescription").value.trim(), amount = Number($("commissionAmount").value);
    if (!description || !(amount >= 0)) { $("commissionStatus").textContent = "Enter a description and amount."; return; }
    const { error } = await db.from("employee_commissions").insert({ employee_id:$("payrollEmployee").value, earned_on:$("commissionDate").value, description, amount });
    $("commissionStatus").textContent = error ? error.message : "Commission added.";
    if (!error) { $("commissionDescription").value = ""; $("commissionAmount").value = ""; await loadPayrollAdmin(); }
  }

  async function saveStub() {
    const pay = calculatePayroll();
    if (!pay) return;
    const { employeeName, ...row } = pay;
    const { error } = await db.from("pay_stubs").upsert(row, { onConflict:"employee_id,period_start,period_end" });
    toast(error ? "Could not save pay stub: " + error.message : "Pay stub saved.");
    if (!error) await loadPayrollAdmin();
  }

  function printStub() {
    if (!calculatePayroll()) return;
    document.body.classList.add("printing-pay-stub");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-pay-stub"), 500);
  }

  async function init() {
    addPanels();
    const { data:{ user } } = await db.auth.getUser();
    currentUser = user;
    defaultPeriod();
    $("clockAction")?.addEventListener("click", clockAction);
    $("refreshTimesheet")?.addEventListener("click", loadMyTimesheet);
    $("refreshPayroll")?.addEventListener("click", loadPayrollAdmin);
    $("refreshEmployees")?.addEventListener("click", loadEmployeeAdmin);
    $("employeeInviteForm")?.addEventListener("submit", inviteEmployee);
    $("employeeAdminList")?.addEventListener("click", employeeListAction);
    $("payrollEmployee")?.addEventListener("change", () => { syncEmployee(); calculatePayroll(); });
    ["payPeriodStart","payPeriodEnd","payOtherEarnings","payDeductions"].forEach(id => $(id)?.addEventListener("input", calculatePayroll));
    $("savePayrollWage")?.addEventListener("click", saveWage);
    $("addCommission")?.addEventListener("click", addCommission);
    $("calculatePayroll")?.addEventListener("click", calculatePayroll);
    $("savePayStub")?.addEventListener("click", saveStub);
    $("printPayStub")?.addEventListener("click", printStub);
    window.loadEmployeeTimesheet = loadMyTimesheet;
    window.loadPayrollAdmin = loadPayrollAdmin;
    window.loadEmployeeAdmin = loadEmployeeAdmin;
  }

  window.addEventListener("mostaffready", init, { once:true });
  if (window.moStaff) init();
})();
