-- Allow checkout-only rows and store hosted checkout URL
ALTER TABLE public.clickpesa_fee_bills
  ALTER COLUMN control_number DROP NOT NULL;

ALTER TABLE public.clickpesa_fee_bills
  ADD COLUMN IF NOT EXISTS checkout_link text;

COMMENT ON COLUMN public.clickpesa_fee_bills.checkout_link IS
  'ClickPesa hosted checkout URL when parent pays via checkout link.';

ALTER TABLE public.clickpesa_fee_bills
  ADD CONSTRAINT clickpesa_fee_bills_has_payment_method
  CHECK (
    (control_number IS NOT NULL AND trim(control_number) <> '')
    OR (checkout_link IS NOT NULL AND trim(checkout_link) <> '')
  );
