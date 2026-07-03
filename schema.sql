-- ============================================================
-- ระบบเช็คสิทธิวันลาพนักงาน — สร้างตาราง employees
-- รันไฟล์นี้ใน Supabase Dashboard > SQL Editor (project: officialHH / Leave)
-- ============================================================

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique not null,
  first_name text not null,
  last_name text not null,
  position text,
  start_date date not null,
  status text not null default 'ทำงานอยู่'
    check (status in ('ทำงานอยู่', 'ลาออก', 'พักงาน')),
  phone text,
  notes text,
  employee_type text not null default 'รายเดือน'
    check (employee_type in ('รายเดือน', 'เหมารายชิ้น')),
  sewing_nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ค้นหาด้วยชื่อ-นามสกุลได้เร็วขึ้น (ใช้ match กับ leave_requests)
create index if not exists idx_employees_name
  on employees (lower(first_name), lower(last_name));

-- อัปเดต updated_at อัตโนมัติทุกครั้งที่แก้ไข
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_employees_updated_at on employees;
create trigger trg_employees_updated_at
  before update on employees
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- หน้าเช็คสิทธิพนักงานไม่มีล็อกอิน จึงต้องเปิดอ่านได้แบบ public (anon key)
-- หน้าแอดมินก็ใช้ anon key ตัวเดียวกัน ป้องกันด้วย PIN ที่ฝั่ง UI เท่านั้น
-- (แบบเดียวกับระบบ SewingGrade/QC เดิม) — ไม่ใช่การป้องกันระดับ database จริง
-- ถ้าต้องการความปลอดภัยสูงขึ้นในอนาคต แนะนำทำ Cloudflare Function คั่นกลาง
-- แล้วเช็ค PIN ฝั่ง server ก่อนค่อยยิงเข้า Supabase ด้วย service role key
-- ============================================================
alter table employees enable row level security;

drop policy if exists "public read employees" on employees;
create policy "public read employees"
  on employees for select
  using (true);

drop policy if exists "public write employees" on employees;
create policy "public write employees"
  on employees for insert
  with check (true);

drop policy if exists "public update employees" on employees;
create policy "public update employees"
  on employees for update
  using (true) with check (true);

drop policy if exists "public delete employees" on employees;
create policy "public delete employees"
  on employees for delete
  using (true);
