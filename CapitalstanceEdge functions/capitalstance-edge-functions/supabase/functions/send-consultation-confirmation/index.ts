// supabase/functions/send-consultation-confirmation/index.ts
// Trigger: Database Webhook on INSERT to public.consultations
// Sends: booking confirmation to the client/prospect

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = "Capitalstance <hello@capitalstance.co.ke>";
const ADMIN_EMAIL    = "info@capitalstance.co.ke";

serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;

  const {
    contact_name,
    contact_email,
    contact_phone,
    service_topic,
    scheduled_at,
    duration_mins,
    meeting_type,
  } = record;

  if (!contact_email) {
    return new Response(JSON.stringify({ skipped: "no email" }), { status: 200 });
  }

  // Format date/time nicely
  const dt = new Date(scheduled_at);
  const dateStr = dt.toLocaleDateString("en-KE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeStr = dt.toLocaleTimeString("en-KE", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  // Send to client
  await sendEmail({
    to: contact_email,
    subject: `Consultation confirmed — ${dateStr}`,
    html: confirmationHtml({ contact_name, service_topic, dateStr, timeStr, duration_mins, meeting_type }),
  });

  // Notify admin
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Consultation booked: ${contact_name} — ${dateStr} ${timeStr}`,
    html: adminNotifyHtml({ contact_name, contact_email, contact_phone, service_topic, dateStr, timeStr, duration_mins, meeting_type }),
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
}

function confirmationHtml({ contact_name, service_topic, dateStr, timeStr, duration_mins, meeting_type }: any) {
  const mtLabel: Record<string, string> = {
    "in-person": "In-Person Meeting · Nairobi",
    "video": "Video Call (link to follow)",
    "phone": "Phone Call",
    "whatsapp": "WhatsApp Call",
  };
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9F7F2;margin:0;padding:0}
  .wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #E2E8F0}
  .header{background:#0A1628;padding:24px 32px}
  .logo{color:#fff;font-size:17px;font-weight:600}.logo span{color:#C9A84C}
  .body{padding:32px}
  h1{font-size:20px;color:#0A1628;margin:0 0 10px}
  p{font-size:14px;color:#6B7A8D;line-height:1.75;margin:0 0 14px}
  .booking-card{background:#0A1628;border-radius:6px;padding:22px 24px;margin:20px 0;color:#fff}
  .booking-card .bc-label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:4px}
  .booking-card .bc-value{font-size:15px;font-weight:500;margin-bottom:14px}
  .booking-card .bc-value:last-child{margin-bottom:0}
  .booking-card .bc-gold{color:#C9A84C}
  .footer{background:#F7F9FC;padding:18px 32px;text-align:center;font-size:12px;color:#9AAAB8;border-top:1px solid #E2E8F0}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">Capital<span>stance</span> Limited</div></div>
  <div class="body">
    <h1>Your consultation is confirmed</h1>
    <p>Hi ${contact_name || "there"}, we look forward to speaking with you. Here are the details:</p>
    <div class="booking-card">
      <div class="bc-label">Topic</div>
      <div class="bc-value bc-gold">${service_topic || "Tax advisory consultation"}</div>
      <div class="bc-label">Date</div>
      <div class="bc-value">${dateStr}</div>
      <div class="bc-label">Time</div>
      <div class="bc-value">${timeStr} (${duration_mins || 60} minutes)</div>
      <div class="bc-label">Format</div>
      <div class="bc-value">${mtLabel[meeting_type] || meeting_type || "To be confirmed"}</div>
    </div>
    <p>Please come prepared with any relevant documents or questions. If you need to reschedule, contact us at least 24 hours in advance.</p>
    <p style="font-size:13px">Warm regards,<br><strong>The Capitalstance Team</strong><br>+254 700 000 000 · info@capitalstance.co.ke</p>
  </div>
  <div class="footer">© 2025 Capitalstance Limited · Nairobi, Kenya</div>
</div>
</body></html>`;
}

function adminNotifyHtml({ contact_name, contact_email, contact_phone, service_topic, dateStr, timeStr, duration_mins, meeting_type }: any) {
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:-apple-system,sans-serif;background:#F7F9FC;padding:20px}
.wrap{max-width:480px;margin:0 auto;background:#fff;border-radius:6px;border:1px solid #E2E8F0;overflow:hidden}
.header{background:#0A1628;padding:14px 20px;color:#C9A84C;font-size:13px;font-weight:600}
.body{padding:20px}.row{font-size:13px;margin-bottom:8px;color:#0A1628}
.label{color:#9AAAB8;display:inline-block;width:120px}</style></head><body>
<div class="wrap">
  <div class="header">New consultation booked</div>
  <div class="body">
    <div class="row"><span class="label">Client</span>${contact_name || "—"}</div>
    <div class="row"><span class="label">Email</span>${contact_email || "—"}</div>
    <div class="row"><span class="label">Phone</span>${contact_phone || "—"}</div>
    <div class="row"><span class="label">Topic</span>${service_topic || "—"}</div>
    <div class="row"><span class="label">Date</span>${dateStr}</div>
    <div class="row"><span class="label">Time</span>${timeStr} (${duration_mins || 60} min)</div>
    <div class="row"><span class="label">Format</span>${meeting_type || "—"}</div>
  </div>
</div></body></html>`;
}
