const resultEl = document.getElementById("result");
const fnameEl = document.getElementById("fname");
const lnameEl = document.getElementById("lname");
const searchBtn = document.getElementById("searchBtn");

function statusClass(status) {
  if (status === "ลาออก") return "off";
  if (status === "พักงาน") return "pause";
  if (status === "ทดลองงาน") return "pause";
  return ""; // ผ่านโปร บรรจุเป็นพนักงานประจำ
}

function renderLoading() {
  resultEl.innerHTML = `<div class="msg">กำลังค้นหา...</div>`;
}

function renderEmpty(fname, lname) {
  resultEl.innerHTML = `
    <div class="empty-state">
      ไม่พบข้อมูลพนักงานชื่อ "${escapeHtml(fname)} ${escapeHtml(lname)}"<br/>
      กรุณาตรวจสอบการสะกด หรือติดต่อผู้ดูแลระบบ
    </div>`;
}

function renderMultiple(list) {
  const items = list
    .map((e) => `<li>${escapeHtml(e.first_name)} ${escapeHtml(e.last_name)} — รหัส ${escapeHtml(e.employee_code)} (${escapeHtml(e.position || "-")})</li>`)
    .join("");
  resultEl.innerHTML = `
    <div class="msg">
      พบพนักงานชื่อนี้มากกว่า 1 คน กรุณาติดต่อผู้ดูแลระบบเพื่อยืนยันรหัสพนักงาน:
      <ul style="text-align:left; display:inline-block; margin-top:12px;">${items}</ul>
    </div>`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function fmtDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}

async function renderEmployee(emp) {
  resultEl.innerHTML = `<div class="msg">กำลังคำนวณสิทธิวันลา...</div>`;
  const summary = await buildLeaveSummary(emp);

  const spools = LEAVE_TYPES.map((type) => {
    const total = summary.entitlement[type];
    const used = summary.used[type];
    const remain = summary.remaining[type];
    const pct = total > 0 ? Math.min(100, (used / total) * 100) : (used > 0 ? 100 : 0);
    const overClass = remain < 0 ? "over" : `k-${type}`;
    return `
      <div class="spool">
        <div class="top-row">
          <span class="type">${type}</span>
          <span class="nums">สิทธิ <b>${total}</b> วัน · ใช้ไป <b>${used}</b> วัน · คงเหลือ <b style="color:${remain < 0 ? "var(--rust)" : "var(--text)"}">${remain}</b> วัน</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill ${overClass}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join("");

  resultEl.innerHTML = `
    <div class="tag">
      <div class="tag-head">
        <div>
          <div class="name">${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</div>
          <div class="role">${escapeHtml(emp.position || "ไม่ระบุตำแหน่ง")}</div>
        </div>
        <div style="text-align:right;">
          <div class="tag-code mono">${escapeHtml(emp.employee_code)}</div>
          <div style="margin-top:8px;">
            <span class="status-pill ${statusClass(emp.status)}">${escapeHtml(emp.status)}</span>
          </div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="item">
          <div class="label">วันที่เข้าทำงาน</div>
          <div class="value">${fmtDate(emp.start_date)}</div>
        </div>
        <div class="item">
          <div class="label">อายุงาน</div>
          <div class="value">${formatTenure(summary.tenureMonths)}</div>
        </div>
        <div class="item">
          <div class="label">รอบสิทธิปัจจุบัน</div>
          <div class="value">${fmtDate(ymd(summary.windowStart))} – ${fmtDate(ymd(summary.windowEnd))}</div>
        </div>
      </div>

      ${summary.entitlement.tier === "probation" ? `<div class="tier-note">${tierLabel(summary.entitlement.tier)}</div>` : ""}

      <div class="spools">${spools}</div>
    </div>
  `;
}

async function doSearch() {
  const fname = fnameEl.value.trim();
  const lname = lnameEl.value.trim();
  if (!fname || !lname) {
    resultEl.innerHTML = `<div class="msg error">กรุณากรอกทั้งชื่อและนามสกุล</div>`;
    return;
  }
  renderLoading();
  const { data, error } = await sb
    .from("employees")
    .select("*")
    .ilike("first_name", fname)
    .ilike("last_name", lname);

  if (error) {
    resultEl.innerHTML = `<div class="msg error">เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่</div>`;
    console.error(error);
    return;
  }
  if (!data || data.length === 0) {
    renderEmpty(fname, lname);
    return;
  }
  if (data.length > 1) {
    renderMultiple(data);
    return;
  }
  renderEmployee(data[0]);
}

searchBtn.addEventListener("click", doSearch);
[fnameEl, lnameEl].forEach((el) =>
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  })
);

// ------------------------------------------------------------
// tabs
// ------------------------------------------------------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("panel-monthly").style.display = tab === "monthly" ? "block" : "none";
    document.getElementById("panel-tailor").style.display = tab === "tailor" ? "block" : "none";
  });
});

// ------------------------------------------------------------
// หมวด 2: ช่างเย็บผ้าเหมารายชิ้น
// ------------------------------------------------------------
const t_resultEl = document.getElementById("t_result");
const t_fnameEl = document.getElementById("t_fname");
const t_lnameEl = document.getElementById("t_lname");
const t_searchBtn = document.getElementById("t_searchBtn");

let currentTailor = null;
let currentWeekAnchor = new Date();

async function doTailorSearch() {
  const fname = t_fnameEl.value.trim();
  const lname = t_lnameEl.value.trim();
  if (!fname || !lname) {
    t_resultEl.innerHTML = `<div class="msg error">กรุณากรอกทั้งชื่อและนามสกุล</div>`;
    return;
  }
  t_resultEl.innerHTML = `<div class="msg">กำลังค้นหา...</div>`;

  const { data, error } = await sb
    .from("employees")
    .select("*")
    .ilike("first_name", fname)
    .ilike("last_name", lname)
    .eq("employee_type", "เหมารายชิ้น");

  if (error) {
    t_resultEl.innerHTML = `<div class="msg error">เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่</div>`;
    console.error(error);
    return;
  }
  if (!data || data.length === 0) {
    t_resultEl.innerHTML = `<div class="empty-state">ไม่พบข้อมูลช่างเย็บผ้าชื่อ "${escapeHtml(fname)} ${escapeHtml(lname)}"<br/>กรุณาตรวจสอบการสะกด หรือติดต่อผู้ดูแลระบบ</div>`;
    return;
  }
  if (data.length > 1) {
    renderMultipleTailor(data);
    return;
  }
  currentTailor = data[0];
  currentWeekAnchor = new Date();
  await renderTailor();
}

function renderMultipleTailor(list) {
  const items = list
    .map((e) => `<li>${escapeHtml(e.first_name)} ${escapeHtml(e.last_name)} — รหัส ${escapeHtml(e.employee_code)}</li>`)
    .join("");
  t_resultEl.innerHTML = `
    <div class="msg">
      พบพนักงานชื่อนี้มากกว่า 1 คน กรุณาติดต่อผู้ดูแลระบบเพื่อยืนยันรหัสพนักงาน:
      <ul style="text-align:left; display:inline-block; margin-top:12px;">${items}</ul>
    </div>`;
}

async function renderTailor() {
  const emp = currentTailor;
  t_resultEl.innerHTML = `<div class="msg">กำลังโหลดข้อมูลการส่งงาน...</div>`;

  const tenureMonths = calcTenureMonths(emp.start_date);
  const { start, end } = getWeekRange(currentWeekAnchor);

  if (!emp.sewing_nickname) {
    t_resultEl.innerHTML = `
      <div class="tag">
        <div class="tag-head">
          <div>
            <div class="name">${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</div>
            <div class="role">${escapeHtml(emp.position || "ช่างเย็บผ้าเหมารายชิ้น")}</div>
          </div>
          <div class="tag-code mono">${escapeHtml(emp.employee_code)}</div>
        </div>
        <div class="tier-note">ยังไม่ได้ตั้งค่าชื่อเล่นในระบบเกรด กรุณาติดต่อผู้ดูแลระบบให้ผูกข้อมูลให้ก่อน</div>
      </div>`;
    return;
  }

  const submissions = await fetchTailorWeekSubmissions(emp.sewing_nickname, start, end);
  const summary = summarizeTailorWeek(submissions);

  const gradeRows = GRADES.map((g) => {
    const val = summary.byGrade[g];
    const max = Math.max(1, ...GRADES.map((k) => summary.byGrade[k]));
    return `
      <div class="type-bar-row">
        <div class="tname grade-${g}">เกรด ${g}</div>
        <div class="track"><div class="fill grade-${g}" style="width:${(val / max) * 100}%; background:currentColor;"></div></div>
        <div class="tval">${val} ชิ้น</div>
      </div>`;
  }).join("");

  const photos = summary.images.length
    ? `<div class="photo-grid">${summary.images.map((u) => `<img src="${u}" loading="lazy" onclick="window.open('${u}','_blank')" />`).join("")}</div>`
    : `<div class="msg" style="padding:14px 0;">ไม่มีรูปภาพในสัปดาห์นี้</div>`;

  t_resultEl.innerHTML = `
    <div class="tag">
      <div class="tag-head">
        <div>
          <div class="name">${escapeHtml(emp.first_name)} ${escapeHtml(emp.last_name)}</div>
          <div class="role">${escapeHtml(emp.position || "ช่างเย็บผ้าเหมารายชิ้น")}</div>
        </div>
        <div style="text-align:right;">
          <div class="tag-code mono">${escapeHtml(emp.employee_code)}</div>
        </div>
      </div>

      <div class="meta-grid">
        <div class="item">
          <div class="label">วันที่เข้าทำงาน</div>
          <div class="value">${fmtDate(emp.start_date)}</div>
        </div>
        <div class="item">
          <div class="label">อายุงาน</div>
          <div class="value">${formatTenure(tenureMonths)}</div>
        </div>
        <div class="item">
          <div class="label">ชื่อในระบบเกรด</div>
          <div class="value">${escapeHtml(emp.sewing_nickname)}</div>
        </div>
      </div>

      <div class="week-nav">
        <button class="btn-ghost btn-sm" id="prevWeek">‹ สัปดาห์ก่อน</button>
        <span class="range">${fmtDateShort(start)} – ${fmtDateShort(end)}</span>
        <button class="btn-ghost btn-sm" id="nextWeek">สัปดาห์ถัดไป ›</button>
      </div>

      <div class="meta-grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom:20px;">
        <div class="item">
          <div class="label">ชิ้นงานที่ส่งรวม</div>
          <div class="value" style="font-size:20px;">${summary.totalPieces} ชิ้น</div>
        </div>
        <div class="item">
          <div class="label">จำนวนรอบที่ต้องแก้งาน (BB)</div>
          <div class="value" style="font-size:20px; color:${summary.reworkRounds > 0 ? "var(--rust)" : "var(--text)"}">${summary.reworkRounds} รอบ</div>
        </div>
      </div>

      <div style="margin-bottom:22px;">${gradeRows}</div>

      <div class="label" style="font-size:11.5px; color:var(--text-faint); margin-bottom:6px;">รูปภาพงานที่ส่งสัปดาห์นี้</div>
      ${photos}
    </div>
  `;

  document.getElementById("prevWeek").addEventListener("click", () => {
    currentWeekAnchor = new Date(start);
    currentWeekAnchor.setDate(currentWeekAnchor.getDate() - 7);
    renderTailor();
  });
  document.getElementById("nextWeek").addEventListener("click", () => {
    currentWeekAnchor = new Date(start);
    currentWeekAnchor.setDate(currentWeekAnchor.getDate() + 7);
    renderTailor();
  });
}

t_searchBtn.addEventListener("click", doTailorSearch);
[t_fnameEl, t_lnameEl].forEach((el) =>
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doTailorSearch();
  })
);
