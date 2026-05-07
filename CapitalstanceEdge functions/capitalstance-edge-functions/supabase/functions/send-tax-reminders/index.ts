// supabase/functions/send-tax-reminders/index.ts
// Trigger: Supabase Cron — runs every day at 08:00 EAT (05:00 UTC)
// Cron schedule in supabase/config.toml:  "0 5 * * *"
// Sends: reminder emails to clients with tax obligations due in 7 days

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL    = Deno.env.get("DB_URL")!;
const SUPABASE_KEY    = Deno.env.get("DB_SERVICE_ROLE_KEY")!;  // service role for server-side reads
const FROM_EMAIL      = "Capitalstance <reminders@capitalstance.co.ke>";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

serve(async (_req) => {
  // Find all obligations due exactly 7 days from today, still pending
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 7);
  const dateStr = targetDate.toISOString().split("T")[0]; // YYYY-MM-DD

  const { data: obligations, error } = await supabase
    .from("tax_obligations")
    .select(`
      id,
      obligation_type,
      tax_period,
      due_date,
      tax_payable,
      clients (
        id,
        company_name,
        contacts ( first_name, last_name, email, is_primary )
      )
    `)
    .eq("due_date", dateStr)
    .in("status", ["pending"]);

  if (error) {
    console.error("DB query error:", error);
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  let sent = 0;
  for (const ob of obligations ?? []) {
    const client = ob.clients as any;
    const primaryContact = (client?.contacts as any[])?.find((c: any) => c.is_primary) 
                        ?? (client?.contacts as any[])?.[0];

    if (!primaryContact?.email) continue;

    await sendEmail({
      to: primaryContact.email,
      subject: `Reminder: ${ob.obligation_type} return due in 7 days — ${client.company_name}`,
      html: reminderHtml({
        contactName: `${primaryContact.first_name} ${primaryContact.last_name}`,
        companyName: client.company_name,
        obligationType: ob.obligation_type,
        taxPeriod: ob.tax_period,
        dueDate: new Date(ob.due_date).toLocaleDateString("en-KE", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        }),
        taxPayable: ob.tax_payable,
      }),
    });
    sent++;
  }

  console.log(`Sent ${sent} reminder emails for due date ${dateStr}`);
  return new Response(JSON.stringify({ sent, date: dateStr }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) console.error("Resend error:", await res.text());
}

function reminderHtml({ contactName, companyName, obligationType, taxPeriod, dueDate, taxPayable }: any) {
  return `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9F7F2;margin:0;padding:0}
  .wrap{max-width:560px;margin:40px auto;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #E2E8F0}
  .header{background:#0A1628;padding:24px 32px;display:flex;align-items:center;justify-content:space-between}
  .logo{color:#fff;font-size:17px;font-weight:600}.logo span{color:#C9A84C}
  .badge{background:rgba(201,168,76,.2);color:#C9A84C;font-size:11px;padding:3px 10px;border-radius:10px;letter-spacing:.06em}
  .body{padding:32px}
  h1{font-size:19px;color:#0A1628;margin:0 0 10px}
  p{font-size:14px;color:#6B7A8D;line-height:1.75;margin:0 0 14px}
  .alert-box{background:#FAEEDA;border-left:4px solid #C9A84C;padding:16px 18px;border-radius:3px;margin:18px 0}
  .alert-box .row{display:flex;gap:12px;font-size:13px;margin-bottom:6px}
  .alert-box .row:last-child{margin-bottom:0}
  .label{color:#854F0B;width:130px;flex-shrink:0;font-weight:500}
  .value{color:#0A1628;font-weight:500}
  .cta{display:inline-block;background:#C9A84C;color:#0A1628;padding:11px 24px;border-radius:3px;text-decoration:none;font-size:14px;font-weight:600;margin:6px 0}
  .footer{background:#F7F9FC;padding:18px 32px;text-align:center;font-size:12px;color:#9AAAB8;border-top:1px solid #E2E8F0}
</style></head><body>
<div class="wrap">
  <div class="header">
    <div class="logo">Capital<span>stance</span> Limited</div>
    <div class="badge">Filing reminder</div>
  </div>
  <div class="body">
    <h1>Your ${obligationType} return is due in 7 days</h1>
    <p>Hi ${contactName}, this is a courtesy reminder from Capitalstance regarding an upcoming tax filing deadline for <strong>${companyName}</strong>.</p>
    <div class="alert-box">
      <div class="row"><span class="label">Obligation</span><span class="value">${obligationType}</span></div>
      <div class="row"><span class="label">Period</span><span class="value">${taxPeriod || "—"}</span></div>
      <div class="row"><span class="label">Due date</span><span class="value">${dueDate}</span></div>
      ${taxPayable ? `<div class="row"><span class="label">Estimated tax</span><span class="value">KES ${Number(taxPayable).toLocaleString()}</span></div>` : ""}
    </div>
    <p>Our team is already working on this. If you have any questions or need to provide documents, please reply to this email or reach us on WhatsApp.</p>
    <a class="cta" href="https://wa.me/254700000000">WhatsApp us now</a>
    <p style="margin-top:20px;font-size:13px">Regards,<br><strong>Capitalstance Compliance Team</strong></p>
  </div>
  <div class="footer">© 2025 Capitalstance Limited · Nairobi, Kenya</div>
</div>
</body></html>`;
}
