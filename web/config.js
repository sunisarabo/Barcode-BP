/*
 * config.js — ตั้งค่า endpoint สำหรับส่ง scan log เข้า Google Sheet
 *
 * ⚠️ ความปลอดภัย: ถ้า repo/หน้าเว็บเป็น public ทุกคนจะเห็น URL นี้และส่งข้อมูลเข้า
 * Google Sheet ของคุณได้ (endpoint เขียนอย่างเดียว ไม่ลบข้อมูล) หากต้องการยกเลิก/
 * เปลี่ยน: redeploy Google Apps Script ให้ได้ URL ใหม่ แล้วแก้ค่าด้านล่าง
 * (หรือทำ repo เป็น private)
 *
 * ตั้งเป็น "" (ว่าง) เพื่อปิดการส่งอัตโนมัติ
 */
window.SHEET_URL =
  "https://script.google.com/macros/s/AKfycbz8_CQfl8Wcpgg7ztjVGEVJ9IHqJaR-u_4iikIQdHwiHcAtjRdUxqybYX83gJRg7tCxEQ/exec";
