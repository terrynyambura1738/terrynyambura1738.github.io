// supabase/functions/send-enquiry-email/index.ts
// Trigger: Database Webhook on INSERT to public.enquiries
// Sends: (1) confirmation email to the prospect, (2) internal alert to Capitalstance

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "Capitalstance <onboarding@resend.dev>";
const ADMIN_EMAIL = "terrynyambura1674@gmail.com";
const SITE_URL       = "https://capitalstance.co.ke";

serve(async (req) => {
  const payload = await req.json();
  // Supabase DB webhook sends { type, table, record, old_record }
  const record = payload.record;

  const {
    first_name,
    last_name,
    email,
    phone,
    service_interest,
    message,
  } = record;

  const fullName = `${first_name} ${last_name}`;

  // ── 1. Confirmation email to the prospect ──────────────────────────────────
  if (email) {
    await sendEmail({
      to: email,
      subject: "We've received your enquiry — Capitalstance Limited",
      html: clientConfirmationHtml({ fullName, service_interest, message }),
    });
  }

  // ── 2. Internal alert to Capitalstance ────────────────────────────────────
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `New enquiry: ${fullName} — ${service_interest || "General"}`,
    html: adminAlertHtml({ fullName, email, phone, service_interest, message }),
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

// ── Resend API helper ──────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error:", err);
  }
}

// ── Email templates ────────────────────────────────────────────────────────────
function clientConfirmationHtml({ fullName, service_interest, message }: any) {
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9F7F2;margin:0;padding:0}
  .wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #E2E8F0}
  .header{background:#0A1628;padding:28px 32px}
  .logo{color:#fff;font-size:18px;font-weight:600;letter-spacing:.02em}
  .logo span{color:#C9A84C}
  .body{padding:32px}
  .body h1{font-size:20px;color:#0A1628;margin:0 0 8px}
  .body p{font-size:14px;color:#6B7A8D;line-height:1.7;margin:0 0 14px}
  .highlight{background:#EEF3F9;border-left:3px solid #C9A84C;padding:14px 18px;border-radius:3px;margin:20px 0}
  .highlight p{margin:0;color:#0A1628;font-size:13px}
  .cta{display:inline-block;background:#C9A84C;color:#0A1628;padding:12px 24px;border-radius:3px;text-decoration:none;font-size:14px;font-weight:600;margin:8px 0}
  .footer{background:#F7F9FC;padding:20px 32px;text-align:center;font-size:12px;color:#9AAAB8;border-top:1px solid #E2E8F0}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">Capital<span>stance</span> Limited</div></div>
  <div class="body">
    <h1>Thank you, ${fullName}</h1>
    <p>We've received your enquiry and will respond within one business day. Here's a summary of what you sent us:</p>
    <div class="highlight">
      <p><strong>Service:</strong> ${service_interest || "General enquiry"}</p>
      ${message ? `<p style="margin-top:8px"><strong>Message:</strong> ${message}</p>` : ""}
    </div>
    <p>In the meantime, feel free to reach us directly on WhatsApp or email if your matter is urgent.</p>
    <a class="cta" href="https://wa.me/254700000000">Chat on WhatsApp</a>
    <p style="margin-top:20px;font-size:13px">Warm regards,<br><strong>The Capitalstance Team</strong><br>Nairobi, Kenya</p>
  </div>
  <div class="footer">© 2025 Capitalstance Limited · info@capitalstance.co.ke · Nairobi, Kenya</div>
</div>
</body></html>`;
}

function adminAlertHtml({ fullName, email, phone, service_interest, message }: any) {
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:-apple-system,sans-serif;background:#F7F9FC;margin:0;padding:0}
  .wrap{max-width:520px;margin:32px auto;background:#fff;border-radius:6px;border:1px solid #E2E8F0;overflow:hidden}
  .header{background:#0A1628;padding:18px 24px;display:flex;align-items:center;justify-content:space-between}
  .logo{color:#C9A84C;font-size:14px;font-weight:600}
  .badge{background:rgba(201,168,76,.2);color:#C9A84C;font-size:11px;padding:3px 8px;border-radius:10px}
  .body{padding:24px}
  .row{display:flex;gap:12px;margin-bottom:10px;font-size:13px}
  .label{color:#9AAAB8;width:120px;flex-shrink:0;font-weight:500}
  .value{color:#0A1628}
  .msg{background:#EEF3F9;padding:12px;border-radius:4px;font-size:13px;color:#1E3A5F;margin-top:14px;line-height:1.65}
  .cta{display:inline-block;background:#C9A84C;color:#0A1628;padding:10px 20px;border-radius:3px;text-decoration:none;font-size:13px;font-weight:600;margin-top:16px}
</style></head><body>
<div class="wrap">
  <div class="header"><span class="logo">Capitalstance Admin</span><span class="badge">New enquiry</span></div>
  <div class="body">
    <div class="row"><span class="label">Name</span><span class="value">${fullName}</span></div>
    <div class="row"><span class="label">Email</span><span class="value">${email || "—"}</span></div>
    <div class="row"><span class="label">Phone</span><span class="value">${phone || "—"}</span></div>
    <div class="row"><span class="label">Service interest</span><span class="value">${service_interest || "General"}</span></div>
    ${message ? `<div class="msg">${message}</div>` : ""}
    <a class="cta" href="https://admin.capitalstance.co.ke">View in admin dashboard</a>
  </div>
</div>
</body></html>`;
}
