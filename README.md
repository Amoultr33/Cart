# Cart + Receipts PWA

This is a starter PWA for a future household purchase system. It has two main sections: Receipts and Cart. Cart is a placeholder for now. Receipts can save uploaded receipt files to Supabase Storage and save receipt records/items in Supabase.

## Files

- `index.html` — app layout
- `styles.css` — warm receipt/bookkeeping style
- `app.js` — frontend logic and Supabase connection
- `manifest.json` — PWA install settings
- `sw.js` — simple offline cache
- `supabase-schema.sql` — database tables and starter policies
- `supabase/functions/parse-receipt/index.ts` — placeholder Edge Function for AI parsing

## Setup

1. Create a Supabase project.
2. Run `supabase-schema.sql` in the Supabase SQL Editor.
3. Create a Supabase Storage bucket named `receipts`.
4. In `app.js`, replace:
   - `YOUR_SUPABASE_URL`
   - `YOUR_SUPABASE_ANON_KEY`
5. Upload these files to a GitHub repository.
6. Turn on GitHub Pages for the repository.

## AI Receipt Parsing

Do not put an OpenAI key or any AI API key directly in `app.js`. The included Edge Function is where AI parsing should go later. The frontend can upload the receipt and call `parse-receipt`; the Edge Function should read the receipt file, run OCR/AI extraction, then insert rows into `receipt_items`.

## Email Receipts Later

The database already includes `source_type` and `email_message_id`. Later, Gmail imports can create a `receipts` row with `source_type = 'email'` and then pass the email body/PDF through the same parser.
