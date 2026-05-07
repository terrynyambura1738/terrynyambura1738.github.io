// supabase/functions/send-welcome-email/index.ts
// Trigger: Database Webhook on INSERT to public.newsletter_subscribers
// Sends: branded welcome email to new subscriber

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = "Capitalstance Insights <insights@capitalstance.co.ke>";

serve(async (req) => {
  const payload = await req.json();
  const { email, first_name } = payload.record;

  await sendEmail({
    to: email,
    subject: "Welcome to Capitalstance Insights",
    html: welcomeHtml({ email, first_name }),
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
}

function welcomeHtml({ email, first_name }: any) {
  const greeting = first_name ? `Hi ${first_name},` : "Hi there,";
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9F7F2;margin:0;padding:0}
  .wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #E2E8F0}
  .header{background:#0A1628;padding:28px 32px;text-align:center}
  .logo{color:#fff;font-size:20px;font-weight:600}
  .logo span{color:#C9A84C}
  .tagline{color:rgba(255,255,255,.5);font-size:12px;margin-top:4px;letter-spacing:.08em;text-transform:uppercase}
  .body{padding:32px}
  h1{font-size:20px;color:#0A1628;margin:0 0 12px}
  p{font-size:14px;color:#6B7A8D;line-height:1.75;margin:0 0 14px}
  .topics{display:grid;gap:10px;margin:20px 0}
  .topic{background:#EEF3F9;border-left:3px solid #C9A84C;padding:10px 14px;border-radius:2px;font-size:13px;color:#0A1628}
  .topic strong{display:block;margin-bottom:2px}
  .cta{display:inline-block;background:#C9A84C;color:#0A1628;padding:12px 28px;border-radius:3px;text-decoration:none;font-size:14px;font-weight:600;margin:10px 0}
  .footer{background:#F7F9FC;padding:18px 32px;text-align:center;font-size:12px;color:#9AAAB8;border-top:1px solid #E2E8F0}
  .footer a{color:#9AAAB8}
</style></head><body>
<div class="wrap">
  <div class="header">
    <div class="logo">Capital<span>stance</span> Limited</div>
    <div class="tagline">Tax &amp; Financial Advisory · Nairobi</div>
  </div>
  <div class="body">
    <h1>${greeting} You're in.</h1>
    <p>You've subscribed to <strong>Capitalstance Insights</strong> — weekly intelligence on Kenya's tax landscape, delivered straight to your inbox.</p>
    <p>Here's what you'll receive:</p>
    <div class="topics">
      <div class="topic"><strong>Weekly tax updates</strong>KRA changes, new regulations, Finance Act developments</div>
      <div class="topic"><strong>SME compliance tips</strong>Practical guides on VAT, PAYE, and payroll deadlines</div>
      <div class="topic"><strong>Budget analysis</strong>Breakdowns of Finance Bill proposals and what they mean for you</div>
      <div class="topic"><strong>Director strategies</strong>Legal tax optimisation for company directors and investors</div>
    </div>
    <p>Ready to explore our latest insights?</p>
    <a class="cta" href="https://capitalstance.co.ke">Browse insights →</a>
    <p style="margin-top:24px;font-size:13px">Questions? Reply to this email or WhatsApp us directly.</p>
    <p style="font-size:13px">Warm regards,<br><strong>The Capitalstance Team</strong></p>
  </div>
  <div class="footer">
    © 2025 Capitalstance Limited · Nairobi, Kenya<br>
    <a href="https://capitalstance.co.ke/unsubscribe?email=${encodeURIComponent(email)}">Unsubscribe</a>
  </div>
</div>
</body></html>`;
}
