-- ============================================================
-- Migration: เพิ่มหมวดช่างเย็บผ้าเหมารายชิ้น
-- รันไฟล์นี้ใน Supabase SQL Editor (project: officialHH / Leave)
-- ใช้ต่อจาก schema.sql เดิมที่รันไปแล้ว (เป็นการ ALTER ตารางที่มีอยู่)
-- ============================================================

-- ประเภทพนักงาน: รายเดือน (มีสิทธิวันลา) / เหมารายชิ้น (ช่างเย็บผ้า ดูข้อมูลส่งงานแทน)
alter table employees add column if not exists employee_type text not null default 'รายเดือน'
  check (employee_type in ('รายเดือน', 'เหมารายชิ้น'));

-- ชื่อเล่นที่ใช้ในระบบเกรดช่างเย็บผ้า (sewing-grade-system) — ใช้ match กับ submissions.tailor_name
-- ใส่เฉพาะพนักงานที่ employee_type = 'เหมารายชิ้น'
alter table employees add column if not exists sewing_nickname text;
