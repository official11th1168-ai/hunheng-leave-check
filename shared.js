// ============================================================
// ค่าตั้งต้น — เชื่อมกับ Supabase project เดียวกับระบบใบลา (officialHH)
// ============================================================
const SUPABASE_URL = "https://gvjhwgzbtrkpooetgyom.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2amh3Z3pidHJrcG9vZXRneW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NzYwNTIsImV4cCI6MjA5ODU1MjA1Mn0.HcrIxVEriTMHFNBdKanxV3WkMRem1JL2hQeByGAfNhw";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LEAVE_TYPES = ["ลากิจ", "ลาป่วย", "ลาพักร้อน"];
const APPROVED_STATUS = "อนุมัติ";

// ------------------------------------------------------------
// อายุงาน
// ------------------------------------------------------------
function calcTenureMonths(startDateStr, asOf = new Date()) {
  const start = new Date(startDateStr + "T00:00:00");
  let months =
    (asOf.getFullYear() - start.getFullYear()) * 12 +
    (asOf.getMonth() - start.getMonth());
  if (asOf.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

function formatTenure(months) {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y > 0) parts.push(`${y} ปี`);
  parts.push(`${m} เดือน`);
  return parts.join(" ");
}

// หาช่วง "ปีสิทธิ" ปัจจุบัน นับจากวันครบรอบเข้างานของแต่ละคน (anniversary year)
function getAnniversaryWindow(startDateStr, asOf = new Date()) {
  const start = new Date(startDateStr + "T00:00:00");
  let years = asOf.getFullYear() - start.getFullYear();
  let anniv = new Date(start);
  anniv.setFullYear(start.getFullYear() + years);
  if (anniv > asOf) {
    years -= 1;
    anniv = new Date(start);
    anniv.setFullYear(start.getFullYear() + years);
  }
  const windowStart = anniv;
  const windowEnd = new Date(anniv);
  windowEnd.setFullYear(windowEnd.getFullYear() + 1);
  return { windowStart, windowEnd };
}

// ------------------------------------------------------------
// กติกาสิทธิวันลา
//   < 6 เดือน (ยังไม่ผ่านโปร)      : ไม่มีสิทธิวันลาแบบมีเงิน (unpaid)
//   6-11 เดือน                     : ลากิจ 1 / ลาป่วย 15 / ลาพักร้อน 0
//   >= 12 เดือน                    : ลากิจ 2 / ลาป่วย 30 / ลาพักร้อน 15
// ------------------------------------------------------------
function getEntitlement(tenureMonths) {
  if (tenureMonths < 6) {
    return { ลากิจ: 0, ลาป่วย: 0, ลาพักร้อน: 0, tier: "probation" };
  } else if (tenureMonths < 12) {
    return { ลากิจ: 1, ลาป่วย: 15, ลาพักร้อน: 0, tier: "under1y" };
  }
  return { ลากิจ: 2, ลาป่วย: 30, ลาพักร้อน: 15, tier: "full" };
}

function tierLabel(tier) {
  switch (tier) {
    case "probation":
      return "อยู่ระหว่างทดลองงาน / ยังไม่ผ่านโปร (ลาได้แต่ไม่ได้รับค่าจ้างวันลา)";
    case "under1y":
      return "ผ่านโปรแล้ว อายุงานยังไม่ครบ 1 ปี";
    default:
      return "อายุงานครบ 1 ปีขึ้นไป (สิทธิเต็ม)";
  }
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------
// ดึงใบลาที่อนุมัติแล้วของพนักงาน ภายในช่วงปีสิทธิปัจจุบัน
// ------------------------------------------------------------
async function fetchApprovedLeave(firstName, lastName, windowStart, windowEnd) {
  const { data, error } = await sb
    .from("leave_requests")
    .select("leave_type,total_days,start_date,status")
    .ilike("first_name", firstName.trim())
    .ilike("last_name", lastName.trim())
    .eq("status", APPROVED_STATUS)
    .gte("start_date", ymd(windowStart))
    .lt("start_date", ymd(windowEnd));
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

function sumUsedByType(rows) {
  const used = { ลากิจ: 0, ลาป่วย: 0, ลาพักร้อน: 0 };
  rows.forEach((r) => {
    if (used[r.leave_type] !== undefined) {
      used[r.leave_type] += Number(r.total_days || 0);
    }
  });
  return used;
}

// ============================================================
// ระบบเกรดช่างเย็บผ้า (sewing-grade-system) — project แยกต่างหาก
// ============================================================
const SEWING_SUPABASE_URL = "https://rslsjllwrbgjdqavhmbk.supabase.co";
const SEWING_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHNqbGx3cmJnamRxYXZobWJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MDgwMzIsImV4cCI6MjA5ODI4NDAzMn0.pvqr3fkLTZH76cvYYo-7gteJKKORtnlnZwSWA7UkEqM";

const sbGrade = supabase.createClient(SEWING_SUPABASE_URL, SEWING_SUPABASE_ANON_KEY);

const GRADES = ["A", "B", "C", "BB"];

// สัปดาห์ปัจจุบัน (จันทร์-อาทิตย์) ของวันที่ที่กำหนด
function getWeekRange(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function fmtDateShort(d) {
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

async function fetchTailorWeekSubmissions(nickname, weekStart, weekEnd) {
  const { data, error } = await sbGrade
    .from("submissions")
    .select(
      `id, tailor_name, submitted_date, note,
       submission_items (
         id, style_name,
         item_colors (
           id, color_name,
           grade_entries ( id, grade, quantity, bb_round, note ),
           item_color_images ( id, public_url )
         )
       )`
    )
    .ilike("tailor_name", nickname.trim())
    .gte("submitted_date", ymd(weekStart))
    .lte("submitted_date", ymd(weekEnd));
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

function summarizeTailorWeek(submissions) {
  const byGrade = { A: 0, B: 0, C: 0, BB: 0 };
  let totalPieces = 0;
  let reworkRounds = 0;
  const images = [];

  submissions.forEach((sub) => {
    (sub.submission_items || []).forEach((item) => {
      (item.item_colors || []).forEach((color) => {
        (color.grade_entries || []).forEach((g) => {
          const qty = Number(g.quantity || 0);
          totalPieces += qty;
          if (byGrade[g.grade] !== undefined) byGrade[g.grade] += qty;
          if (g.grade === "BB") reworkRounds += 1;
        });
        (color.item_color_images || []).forEach((img) => {
          if (img.public_url) images.push(img.public_url);
        });
      });
    });
  });

  return { totalPieces, byGrade, reworkRounds, images };
}

// รวมข้อมูลสิทธิ + ใช้ไป + คงเหลือ ของพนักงาน 1 คน ณ วันนี้
async function buildLeaveSummary(employee, asOf = new Date()) {
  const tenureMonths = calcTenureMonths(employee.start_date, asOf);
  const entitlement = getEntitlement(tenureMonths);
  const { windowStart, windowEnd } = getAnniversaryWindow(employee.start_date, asOf);
  const rows = await fetchApprovedLeave(employee.first_name, employee.last_name, windowStart, windowEnd);
  const used = sumUsedByType(rows);
  const remaining = {};
  LEAVE_TYPES.forEach((t) => (remaining[t] = entitlement[t] - used[t]));
  return { tenureMonths, entitlement, used, remaining, windowStart, windowEnd };
}
