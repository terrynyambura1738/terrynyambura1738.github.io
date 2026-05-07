// supabase/functions/send-newsletter/index.ts
// Trigger: Called manually from admin dashboard (HTTP POST)
// Sends: newsletter blast to all active subscribers in batches of 50

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL   = Deno.env.get("DB_URL")!;
const SUPABASE_KEY   = Deno.env.get("DB_SERVICE_ROLE_KEY")!;
const FROM_EMAIL     = "Capitalstance Insights <insights@capitalstance.co.ke>";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

serve(async (req) => {
  // Expect JSON body: { subject, previewText, title, body, insightSlug? }
  // Called from admin dashboard "Send newsletter" button
  const { subject, previewText, title, body, insightSlug } = await req.json();

  if (!subject || !title || !body) {
    return new Response(JSON.stringify({ error: "Missing required fields: subject, title, body" }), { status: 400 });
  }

  // Fetch all active subscribers
  const { data: subscribers, error } = await supabase
    .from("newsletter_subscribers")
    .select("email, first_name")
    .eq("status", "active");

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  const total = subscribers?.length ?? 0;
  let sent = 0;
  let failed = 0;

  // Resend supports batch sends — process in chunks of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = (subscribers ?? []).slice(i, i + BATCH_SIZE);
    const emails = batch.map((sub) => ({
      from: FROM_EMAIL,
      to: sub.email,
      subject,
      html: newsletterHtml({
        firstName: sub.first_name,
        previewText,
        title,
        body,
        insightSlug,
        unsubscribeEmail: sub.email,
      }),
    }));

    // Use Resend batch endpoint
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emails),
    });

    if (res.ok) {
      sent += batch.length;
    } else {
      console.error("Batch error:", await res.text());
      failed += batch.length;
    }

    // Brief pause between batches to respect rate limits
    if (i + BATCH_SIZE < total) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // Log the send in insights table if slug provided
  if (insightSlug) {
    await supabase.from("insights").update({ views: 0 }).eq("slug", insightSlug);
  }

  return new Response(JSON.stringify({ total, sent, failed }), {
    headers: { "Content-Type": "application/json" },
  });
});

function newsletterHtml({ firstName, previewText, title, body, insightSlug, unsubscribeEmail }: any) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const readMoreBtn = insightSlug
    ? `<a href="https://capitalstance.co.ke/insights/${insightSlug}" style="display:inline-block;background:#C9A84C;color:#0A1628;padding:11px 24px;border-radius:3px;text-decoration:none;font-size:14px;font-weight:600;margin-top:16px">Read the full article →</a>`
    : "";

  return `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${previewText ? `<div style="display:none;max-height:0;overflow:hidden">${previewText}</div>` : ""}
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9F7F2;margin:0;padding:0}
  .wrap{max-width:580px;margin:40px auto;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #E2E8F0}
  .header{background:#0A1628;padding:20px 32px;display:flex;justify-content:space-between;align-items:center}
  .logo{color:#fff;font-size:17px;font-weight:600}.logo span{color:#C9A84C}
  .issue{color:rgba(255,255,255,.4);font-size:11px;letter-spacing:.08em}
  .divider{height:4px;background:linear-gradient(90deg,#C9A84C,#E8C96A)}
  .body{padding:32px}
  h1{font-size:22px;color:#0A1628;margin:0 0 16px;line-height:1.3}
  p{font-size:14px;color:#4A5568;line-height:1.8;margin:0 0 16px}
  blockquote{border-left:3px solid #C9A84C;margin:20px 0;padding:12px 18px;background:#EEF3F9;font-size:14px;color:#1E3A5F;font-style:italic}
  .footer{background:#F7F9FC;padding:18px 32px;font-size:12px;color:#9AAAB8;border-top:1px solid #E2E8F0;text-align:center}
  .footer a{color:#9AAAB8;text-decoration:underline}
</style></head><body>
<div class="wrap">
  <div class="header">
    <div class="logo">Capital<span>stance</span> Limited</div>
    <div class="issue">Tax Insights</div>
  </div>
  <div class="divider"></div>
  <div class="body">
    <p style="font-size:13px;color:#9AAAB8;margin-bottom:20px">${greeting}</p>
    <h1>${title}</h1>
    ${body}
    ${readMoreBtn}
    <hr style="border:none;border-top:1px solid #E2E8F0;margin:28px 0">
    <p style="font-size:13px;color:#9AAAB8">This insight was prepared by the Capitalstance advisory team. For personalised tax advice, <a href="https://capitalstance.co.ke#contact" style="color:#C9A84C">book a consultation</a>.</p>
  </div>
  <div class="footer">
    © 2025 Capitalstance Limited · Nairobi, Kenya<br>
    <a href="https://capitalstance.co.ke/unsubscribe?email=${encodeURIComponent(unsubscribeEmail)}">Unsubscribe</a> · 
    <a href="https://capitalstance.co.ke">Visit website</a>
  </div>
</div>
</body></html>`;
}
