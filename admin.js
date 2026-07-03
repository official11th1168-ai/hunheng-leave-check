// เปลี่ยนรหัส PIN ตรงนี้ได้เลย (นี่คือการป้องกันฝั่ง UI เท่านั้น ไม่ใช่ระดับ database)
const ADMIN_PIN = "116688";

let allEmployees = [];
let employeeSummaries = {}; // id -> summary

// ------------------------------------------------------------
// PIN gate
// ------------------------------------------------------------
const pinGate = document.getElementById("pinGate");
const adminArea = document.getElementById("adminArea");
const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");

function tryPin() {
  if (pinInput.value === ADMIN_PIN) {
    pinGate.style.display = "none";
    adminArea.style.display = "block";
    sessionStorage.setItem("leaveAdminAuthed", "1");
    init();
  } else {
    pinError.style.display = "block";
    pinInput.value = "";
  }
}
document.getElementById("pinBtn").addEventListener("click", tryPin);
pinInput.addEventListener("keydown", (e) => { if (e.key === "Enter") tryPin(); });

if (sessionStorage.getItem("leaveAdminAuthed") === "1") {
  pinGate.style.display = "none";
  adminArea.style.display = "block";
  init();
}

// ------------------------------------------------------------
// tabs
// ------------------------------------------------------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("tab-employees").style.display = tab === "employees" ? "block" : "none";
    document.getElementById("tab-report").style.display = tab === "report" ? "block" : "none";
    if (tab === "report") loadReport();
  });
});

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}
function statusClass(status) {
  if (status === "ลาออก") return "off";
  if (status === "พักงาน") return "pause";
  return "";
}

// ------------------------------------------------------------
// load + render employee list
// ------------------------------------------------------------
async function init() {
  await loadEmployees();
}

async function loadEmployees() {
  const tbody = document.getElementById("empTableBody");
  tbody.innerHTML = `<tr><td colspan="10" class="msg">กำลังโหลดข้อมูล...</td></tr>`;
  const { data, error } = await sb.from("employees").select("*").order("employee_code");
  if (error) {
    tbody.innerHTML = `<tr><td colspan="10" class="msg error">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    console.error(error);
    return;
  }
  allEmployees = data || [];

  // คำนวณสิทธิของทุกคน (ขนานกัน) — คำนวณเฉพาะพนักงานรายเดือน (เหมารายชิ้นไม่มีสิทธิวันลา)
  employeeSummaries = {};
  await Promise.all(
    allEmployees
      .filter((emp) => emp.employee_type !== "เหมารายชิ้น")
      .map(async (emp) => {
        employeeSummaries[emp.id] = await buildLeaveSummary(emp);
      })
  );

  renderEmployeeTable(allEmployees);
}

function renderEmployeeTable(list) {
  const tbody = document.getElementById("empTableBody");
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="msg">ยังไม่มีข้อมูลพนักงาน</td></tr>`;
    return;
  }
  tbody.innerHTML = list
    .map((emp) => {
      const isTailor = emp.employee_type === "เหมารายชิ้น";
      const s = employeeSummaries[emp.id];
      const remainCell = (type) => {
        if (isTailor || !s) return `<span class="mono" style="color:var(--text-faint)">-</span>`;
        const r = s.remaining[type];
        const color = r < 0 ? "var(--rust)" : "var(--text)";
        return `<span class="mono" style="color:${color}">${r}/${s.entitlement[type]}</span>`;
      };
      const tenureCell = isTailor ? formatTenure(calcTenureMonths(emp.start_date)) : formatTenure(s.tenureMonths);
      return `
        <tr>
          <td class="mono">${escapeHtml(emp.employee_code)}</td>
          <td>${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</td>
          <td>${isTailor ? `<span style="color:var(--amber)">เหมารายชิ้น</span>` : "รายเดือน"}</td>
          <td>${escapeHtml(emp.position || "-")}</td>
          <td>${fmtDate(emp.start_date)}</td>
          <td>${tenureCell}</td>
          <td><span class="status-pill ${statusClass(emp.status)}">${escapeHtml(emp.status)}</span></td>
          <td>${remainCell("ลากิจ")}</td>
          <td>${remainCell("ลาป่วย")}</td>
          <td>${remainCell("ลาพักร้อน")}</td>
          <td>
            <div class="row-actions">
              <button class="btn-ghost btn-sm" onclick="openEdit('${emp.id}')">แก้ไข</button>
              <button class="btn-danger btn-sm" onclick="deleteEmployee('${emp.id}')">ลบ</button>
            </div>
          </td>
        </tr>`;
    })
    .join("");
}

function applyFilters() {
  const q = document.getElementById("empSearch").value.trim().toLowerCase();
  const type = document.getElementById("typeFilter").value;
  let filtered = allEmployees;
  if (type) filtered = filtered.filter((emp) => emp.employee_type === type);
  if (q) {
    filtered = filtered.filter((emp) =>
      [emp.employee_code, emp.first_name, emp.last_name, emp.position, emp.sewing_nickname]
        .join(" ").toLowerCase().includes(q)
    );
  }
  renderEmployeeTable(filtered);
}

document.getElementById("empSearch").addEventListener("input", applyFilters);
document.getElementById("typeFilter").addEventListener("change", applyFilters);

// ------------------------------------------------------------
// add / edit modal
// ------------------------------------------------------------
const overlay = document.getElementById("modalOverlay");
const modalTitle = document.getElementById("modalTitle");
const typeSelect = document.getElementById("f_type");
const nicknameField = document.getElementById("nicknameField");

function toggleNicknameField() {
  nicknameField.style.display = typeSelect.value === "เหมารายชิ้น" ? "block" : "none";
}
typeSelect.addEventListener("change", toggleNicknameField);

function openAdd() {
  modalTitle.textContent = "เพิ่มพนักงาน";
  document.getElementById("editId").value = "";
  ["f_code", "f_fname", "f_lname", "f_position", "f_start", "f_phone", "f_notes", "f_nickname"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
  document.getElementById("f_status").value = "ทำงานอยู่";
  typeSelect.value = "รายเดือน";
  toggleNicknameField();
  overlay.style.display = "flex";
}

window.openEdit = function (id) {
  const emp = allEmployees.find((e) => e.id === id);
  if (!emp) return;
  modalTitle.textContent = "แก้ไขข้อมูลพนักงาน";
  document.getElementById("editId").value = emp.id;
  document.getElementById("f_code").value = emp.employee_code;
  document.getElementById("f_fname").value = emp.first_name;
  document.getElementById("f_lname").value = emp.last_name;
  document.getElementById("f_position").value = emp.position || "";
  document.getElementById("f_start").value = emp.start_date;
  document.getElementById("f_status").value = emp.status;
  document.getElementById("f_phone").value = emp.phone || "";
  document.getElementById("f_notes").value = emp.notes || "";
  typeSelect.value = emp.employee_type || "รายเดือน";
  document.getElementById("f_nickname").value = emp.sewing_nickname || "";
  toggleNicknameField();
  overlay.style.display = "flex";
};

window.deleteEmployee = async function (id) {
  const emp = allEmployees.find((e) => e.id === id);
  if (!emp) return;
  if (!confirm(`ลบข้อมูลพนักงาน "${emp.first_name} ${emp.last_name}" ใช่หรือไม่?`)) return;
  const { error } = await sb.from("employees").delete().eq("id", id);
  if (error) { alert("ลบไม่สำเร็จ"); console.error(error); return; }
  await loadEmployees();
};

document.getElementById("addBtn").addEventListener("click", openAdd);
document.getElementById("cancelModal").addEventListener("click", () => (overlay.style.display = "none"));

document.getElementById("saveModal").addEventListener("click", async () => {
  const id = document.getElementById("editId").value;
  const payload = {
    employee_code: document.getElementById("f_code").value.trim(),
    first_name: document.getElementById("f_fname").value.trim(),
    last_name: document.getElementById("f_lname").value.trim(),
    position: document.getElementById("f_position").value.trim(),
    start_date: document.getElementById("f_start").value,
    status: document.getElementById("f_status").value,
    employee_type: typeSelect.value,
    sewing_nickname: typeSelect.value === "เหมารายชิ้น" ? document.getElementById("f_nickname").value.trim() || null : null,
    phone: document.getElementById("f_phone").value.trim(),
    notes: document.getElementById("f_notes").value.trim(),
  };
  if (!payload.employee_code || !payload.first_name || !payload.last_name || !payload.start_date) {
    alert("กรุณากรอกรหัสพนักงาน ชื่อ นามสกุล และวันที่เข้าทำงาน");
    return;
  }
  if (payload.employee_type === "เหมารายชิ้น" && !payload.sewing_nickname) {
    alert("กรุณากรอกชื่อเล่นในระบบเกรดช่างเย็บผ้า");
    return;
  }

  let error;
  if (id) {
    ({ error } = await sb.from("employees").update(payload).eq("id", id));
  } else {
    ({ error } = await sb.from("employees").insert(payload));
  }
  if (error) {
    alert("บันทึกไม่สำเร็จ: " + error.message);
    console.error(error);
    return;
  }
  overlay.style.display = "none";
  await loadEmployees();
});

// ------------------------------------------------------------
// report tab
// ------------------------------------------------------------
let reportLoaded = false;

async function loadReport() {
  const statGrid = document.getElementById("statGrid");
  const typeBreakdown = document.getElementById("typeBreakdown");
  const leaderboard = document.getElementById("leaderboard");
  statGrid.innerHTML = `<div class="msg">กำลังคำนวณ...</div>`;
  typeBreakdown.innerHTML = "";
  leaderboard.innerHTML = "";

  const activeCount = allEmployees.filter((e) => e.status === "ทำงานอยู่").length;

  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: rows, error } = await sb
    .from("leave_requests")
    .select("first_name,last_name,leave_type,total_days,start_date,status")
    .eq("status", APPROVED_STATUS)
    .gte("start_date", sinceStr);

  if (error) {
    statGrid.innerHTML = `<div class="msg error">โหลดรายงานไม่สำเร็จ</div>`;
    console.error(error);
    return;
  }

  const totalDaysAll = rows.reduce((s, r) => s + Number(r.total_days || 0), 0);
  const totalRequests = rows.length;

  statGrid.innerHTML = `
    <div class="stat-card"><div class="num">${allEmployees.length}</div><div class="lbl">พนักงานทั้งหมด</div></div>
    <div class="stat-card"><div class="num">${activeCount}</div><div class="lbl">ทำงานอยู่ปัจจุบัน</div></div>
    <div class="stat-card"><div class="num">${totalRequests}</div><div class="lbl">ใบลาอนุมัติ (12 เดือน)</div></div>
    <div class="stat-card"><div class="num">${totalDaysAll}</div><div class="lbl">รวมวันลา (12 เดือน)</div></div>
  `;

  // breakdown by type
  const byType = { ลากิจ: 0, ลาป่วย: 0, ลาพักร้อน: 0 };
  rows.forEach((r) => { if (byType[r.leave_type] !== undefined) byType[r.leave_type] += Number(r.total_days || 0); });
  const maxType = Math.max(1, ...Object.values(byType));
  const colorMap = { ลากิจ: "var(--indigo)", ลาป่วย: "var(--amber)", ลาพักร้อน: "var(--green)" };
  typeBreakdown.innerHTML = LEAVE_TYPES.map((t) => `
    <div class="type-bar-row">
      <div class="tname">${t}</div>
      <div class="track"><div class="fill" style="width:${(byType[t] / maxType) * 100}%; background:${colorMap[t]}"></div></div>
      <div class="tval">${byType[t]} วัน</div>
    </div>
  `).join("");

  // leaderboard by employee (match on name)
  const byPerson = {};
  rows.forEach((r) => {
    const key = `${r.first_name.trim().toLowerCase()}|${r.last_name.trim().toLowerCase()}`;
    if (!byPerson[key]) byPerson[key] = { first_name: r.first_name, last_name: r.last_name, total: 0 };
    byPerson[key].total += Number(r.total_days || 0);
  });
  const ranked = Object.values(byPerson).sort((a, b) => b.total - a.total).slice(0, 10);

  if (ranked.length === 0) {
    leaderboard.innerHTML = `<div class="msg">ยังไม่มีข้อมูลใบลาที่อนุมัติในช่วง 12 เดือนล่าสุด</div>`;
  } else {
    leaderboard.innerHTML = ranked.map((p, i) => {
      const matched = allEmployees.find(
        (e) => e.first_name.trim().toLowerCase() === p.first_name.trim().toLowerCase() &&
               e.last_name.trim().toLowerCase() === p.last_name.trim().toLowerCase()
      );
      return `
        <div class="leaderboard-row">
          <div class="rank">${String(i + 1).padStart(2, "0")}</div>
          <div class="who">
            ${escapeHtml(p.first_name)} ${escapeHtml(p.last_name)}
            ${matched ? `<div class="sub">${escapeHtml(matched.employee_code)} · ${escapeHtml(matched.position || "-")}</div>` : `<div class="sub">ไม่พบในระบบพนักงาน — ตรวจสอบการสะกดชื่อ</div>`}
          </div>
          <div class="days">${p.total} วัน</div>
        </div>`;
    }).join("");
  }
}
