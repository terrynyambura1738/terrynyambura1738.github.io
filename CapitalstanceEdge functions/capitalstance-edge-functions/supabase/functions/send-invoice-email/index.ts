// supabase/functions/send-invoice-email/index.ts
// Trigger: Database Webhook on UPDATE to public.invoices WHERE status = 'sent'
// Sends: branded invoice notification email to client

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL   = Deno.env.get("DB_URL")!;
const SUPABASE_KEY   = Deno.env.get("DB_SERVICE_ROLE_KEY")!;
const FROM_EMAIL     = "Capitalstance Billing <billing@capitalstance.co.ke>";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

serve(async (req) => {
  const payload = await req.json();
  const record     = payload.record;
  const oldRecord  = payload.old_record;

  // Only fire when status transitions TO 'sent'
  if (record.status !== "sent" || oldRecord?.status === "sent") {
    return new Response(JSON.stringify({ skipped: "not a sent transition" }), { status: 200 });
  }

  // Fetch client + primary contact
  const { data: client } = await supabase
    .from("clients")
    .select("company_name, contacts(first_name, last_name, email, is_primary)")
    .eq("id", record.client_id)
    .single();

  const contacts = (client as any)?.contacts ?? [];
  const primary  = contacts.find((c: any) => c.is_primary) ?? contacts[0];

  if (!primary?.email) {
    return new Response(JSON.stringify({ skipped: "no contact email" }), { status: 200 });
  }

  // Fetch invoice line items
  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", record.id);

  const dueDate = new Date(record.due_date).toLocaleDateString("en-KE", {
    year: "numeric", month: "long", day: "numeric",
  });
  const issueDate = new Date(record.issue_date).toLocaleDateString("en-KE", {
    year: "numeric", month: "long", day: "numeric",
  });

  await sendEmail({
    to: primary.email,
    subject: `Invoice ${record.invoice_number} — KES ${Number(record.total_amount).toLocaleString()} due ${dueDate}`,
    html: invoiceHtml({
      contactName:    `${primary.first_name} ${primary.last_name}`,
      companyName:    (client as any)?.company_name,
      invoiceNumber:  record.invoice_number,
      issueDate,
      dueDate,
      subtotal:       record.subtotal,
      vatAmount:      record.vat_amount,
      totalAmount:    record.total_amount,
      notes:          record.notes,
      items:          items ?? [],
    }),
  });

  return new Response(JSON.stringify({ success: true }), {
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

function invoiceHtml({ contactName, companyName, invoiceNumber, issueDate, dueDate, subtotal, vatAmount, totalAmount, notes, items }: any) {
  const itemRows = items.map((item: any) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-size:13px;color:#0A1628">${item.description}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-size:13px;text-align:right;color:#0A1628">${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-size:13px;text-align:right;color:#0A1628">KES ${Number(item.unit_price).toLocaleString()}</td>
      <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;font-size:13px;text-align:right;font-weight:500;color:#0A1628">KES ${Number(item.line_total).toLocaleString()}</td>
    </tr>`).join("");

  return `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9F7F2;margin:0;padding:0}
  .wrap{max-width:580px;margin:40px auto;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #E2E8F0}
  .header{background:#0A1628;padding:24px 32px;display:flex;justify-content:space-between;align-items:center}
  .logo{color:#fff;font-size:17px;font-weight:600}.logo span{color:#C9A84C}
  .inv-no{color:rgba(255,255,255,.5);font-size:12px}
  .body{padding:32px}
  .meta{display:flex;justify-content:space-between;margin-bottom:24px;font-size:13px}
  .meta .col .label{color:#9AAAB8;margin-bottom:3px}
  .meta .col .value{color:#0A1628;font-weight:500}
  table{width:100%;border-collapse:collapse}
  th{font-size:11px;font-weight:600;color:#9AAAB8;text-align:left;padding:8px 0;border-bottom:2px solid #E2E8F0;text-transform:uppercase;letter-spacing:.05em}
  th:last-child,td:last-child{text-align:right}
  .totals{margin-top:16px;border-top:2px solid #0A1628;padding-top:12px}
  .total-row{display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px}
  .total-row.grand{font-size:16px;font-weight:600;color:#0A1628;margin-top:8px;padding-top:8px;border-top:1px solid #E2E8F0}
  .pay-methods{background:#EEF3F9;border-radius:4px;padding:16px 18px;margin:20px 0;font-size:13px}
  .pay-methods strong{display:block;margin-bottom:8px;color:#0A1628}
  .pay-methods p{margin:0 0 4px;color:#6B7A8D}
  .footer{background:#F7F9FC;padding:18px 32px;text-align:center;font-size:12px;color:#9AAAB8;border-top:1px solid #E2E8F0}
</style></head><body>
<div class="wrap">
  <div class="header">
    <div class="logo">Capital<span>stance</span> Limited</div>
    <div class="inv-no">Invoice ${invoiceNumber}</div>
  </div>
  <div class="body">
    <div class="meta">
      <div class="col"><div class="label">Billed to</div><div class="value">${contactName}</div><div style="font-size:12px;color:#6B7A8D">${companyName}</div></div>
      <div class="col" style="text-align:right">
        <div class="label">Issue date</div><div class="value">${issueDate}</div>
        <div class="label" style="margin-top:8px">Due date</div><div class="value">${dueDate}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="totals">
      <div class="total-row"><span style="color:#6B7A8D">Subtotal</span><span>KES ${Number(subtotal).toLocaleString()}</span></div>
      <div class="total-row"><span style="color:#6B7A8D">VAT (16%)</span><span>KES ${Number(vatAmount || 0).toLocaleString()}</span></div>
      <div class="total-row grand"><span>Total due</span><span>KES ${Number(totalAmount).toLocaleString()}</span></div>
    </div>
    <div class="pay-methods">
      <strong>Payment methods</strong>
      <p>M-Pesa Paybill: <strong>XXXXXX</strong> · Account: ${invoiceNumber}</p>
      <p>Bank: Equity Bank · Account: XXXX XXXX XXXX · Ref: ${invoiceNumber}</p>
    </div>
    ${notes ? `<p style="font-size:13px;color:#6B7A8D">${notes}</p>` : ""}
    <p style="font-size:13px;color:#6B7A8D">Questions? Reply to this email or call +254 700 000 000.</p>
  </div>
  <div class="footer">© 2025 Capitalstance Limited · Nairobi, Kenya · info@capitalstance.co.ke</div>
</div>
</body></html>`;
}
