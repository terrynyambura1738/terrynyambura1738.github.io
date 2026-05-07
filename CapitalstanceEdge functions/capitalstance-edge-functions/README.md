# Capitalstance — Edge Functions Setup Guide
## Supabase + Resend Email System

---

## Prerequisites
- Supabase project created (supabase.com)
- Resend account created (resend.com)
- Supabase CLI installed: `npm install -g supabase`
- Your domain verified in Resend (capitalstance.co.ke)

---

## Step 1 — Get your API keys

### Resend
1. Go to resend.com → API Keys → Create API Key
2. Copy the key (starts with `re_...`)
3. Also go to Domains → Add domain → add `capitalstance.co.ke`
4. Add the DNS records Resend gives you to your domain registrar

### Supabase
1. Go to your Supabase project → Settings → API
2. Copy: Project URL, anon key, and service_role key

---

## Step 2 — Set environment secrets in Supabase

Run these in your terminal (replace values):

```bash
supabase secrets set RESEND_API_KEY=re_your_key_here
supabase secrets set SUPABASE_URL=https://yourproject.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

These are securely stored and injected into every edge function at runtime.

---

## Step 3 — Deploy all edge functions

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref your-project-id

# Deploy all functions at once
supabase functions deploy send-enquiry-email
supabase functions deploy send-welcome-email
supabase functions deploy send-consultation-confirmation
supabase functions deploy send-tax-reminders
supabase functions deploy send-invoice-email
supabase functions deploy send-newsletter
```

---

## Step 4 — Set up Database Webhooks

In the Supabase dashboard → Database → Webhooks → Create new webhook:

### Webhook 1: Enquiry submitted
- Name: `on_enquiry_insert`
- Table: `public.enquiries`
- Events: ☑ INSERT
- URL: `https://yourproject.supabase.co/functions/v1/send-enquiry-email`
- HTTP Headers: `Authorization: Bearer YOUR_ANON_KEY`

### Webhook 2: Newsletter signup
- Name: `on_subscriber_insert`
- Table: `public.newsletter_subscribers`
- Events: ☑ INSERT
- URL: `https://yourproject.supabase.co/functions/v1/send-welcome-email`

### Webhook 3: Consultation booked
- Name: `on_consultation_insert`
- Table: `public.consultations`
- Events: ☑ INSERT
- URL: `https://yourproject.supabase.co/functions/v1/send-consultation-confirmation`

### Webhook 4: Invoice sent
- Name: `on_invoice_sent`
- Table: `public.invoices`
- Events: ☑ UPDATE
- URL: `https://yourproject.supabase.co/functions/v1/send-invoice-email`
- Condition: Only fires when `status` changes to `'sent'` (handled in function)

---

## Step 5 — Set up the cron job (tax reminders)

In Supabase Dashboard → Database → Extensions → Enable `pg_cron`

Then in SQL Editor, run:
```sql
-- Run send-tax-reminders every day at 05:00 UTC (08:00 EAT)
SELECT cron.schedule(
  'daily-tax-reminders',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://yourproject.supabase.co/functions/v1/send-tax-reminders',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  );
  $$
);
```

---

## Step 6 — Call newsletter from your admin dashboard

In `capitalstance_admin.html`, wire the "Send newsletter" button:

```javascript
async function sendNewsletter() {
  const payload = {
    subject:     "KRA Update: April 2025 — Capitalstance Insights",
    previewText: "What this month's changes mean for your business",
    title:       "What the New KRA Digital Service Tax Means for Your Business",
    body:        `<p>This month KRA introduced...</p><blockquote>Key quote or insight</blockquote><p>More content...</p>`,
    insightSlug: "kra-digital-service-tax-foreign-firms"  // optional
  };

  const res = await fetch('https://yourproject.supabase.co/functions/v1/send-newsletter', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_ANON_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await res.json();
  alert(`Sent to ${result.sent} subscribers`);
}
```

---

## Email From Addresses (set up in Resend)

| Function               | From address                              |
|------------------------|-------------------------------------------|
| Enquiry confirmation   | hello@capitalstance.co.ke                 |
| Welcome email          | insights@capitalstance.co.ke              |
| Consultation confirm   | hello@capitalstance.co.ke                 |
| Tax reminders          | reminders@capitalstance.co.ke             |
| Invoice email          | billing@capitalstance.co.ke               |
| Newsletter             | insights@capitalstance.co.ke              |

All need to be verified under your domain in Resend.

---

## Resend Free Tier Limits
- 3,000 emails/month free
- 100 emails/day
- For more: $20/month for 50,000 emails

For 218 newsletter subscribers + transactional emails, the free tier
comfortably covers Capitalstance's volume.

---

## File Structure

```
supabase/
├── config.toml
└── functions/
    ├── send-enquiry-email/
    │   └── index.ts          ← Contact form → 2 emails
    ├── send-welcome-email/
    │   └── index.ts          ← Newsletter signup → welcome email
    ├── send-consultation-confirmation/
    │   └── index.ts          ← Booking → confirmation email
    ├── send-tax-reminders/
    │   └── index.ts          ← Cron: daily tax deadline reminders
    ├── send-invoice-email/
    │   └── index.ts          ← Invoice marked sent → email to client
    └── send-newsletter/
        └── index.ts          ← Admin triggered bulk send
```
