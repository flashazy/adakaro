const API_BASE = (
  process.env.CLICKPESA_BASE_URL || "https://api.clickpesa.com/third-parties"
).replace(/\/+$/, "");

const CHECKOUT_PATH =
  process.env.CLICKPESA_CHECKOUT_PATH?.trim() ||
  "/checkout-link/generate-checkout-url";

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) return cachedToken;

  const clientId = process.env.CLICKPESA_CLIENT_ID?.trim();
  const apiKey = process.env.CLICKPESA_API_KEY?.trim();
  if (!clientId || !apiKey) {
    throw new Error("CLICKPESA_CLIENT_ID and CLICKPESA_API_KEY are required");
  }

  const response = await fetch(`${API_BASE}/generate-token`, {
    method: "POST",
    headers: {
      "client-id": clientId,
      "api-key": apiKey,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.token) {
    throw new Error(
      data.message || `Failed to obtain token (HTTP ${response.status})`
    );
  }
  const token = String(data.token).replace(/^Bearer\s+/i, "").trim();
  tokenExpiry = Date.now() + 55 * 60 * 1000;
  cachedToken = token;
  return token;
}

/** ClickPesa checkout requires alphanumeric order references */
export function buildAlphanumericOrderReference(
  studentId: string,
  feeStructureId: string
): string {
  const a = studentId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  const b = feeStructureId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  const t = Date.now().toString();
  return `S${a}F${b}T${t}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 64) || `ADK${t}`;
}

function extractCheckoutUrl(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const nested =
    o.data && typeof o.data === "object"
      ? (o.data as Record<string, unknown>)
      : undefined;
  const candidates = [
    o.checkoutLink,
    o.checkout_url,
    o.checkoutUrl,
    o.paymentLink,
    o.payment_url,
    o.url,
    o.link,
    nested?.checkoutLink,
    nested?.checkout_url,
    nested?.url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && /^https?:\/\//i.test(c.trim())) {
      return c.trim();
    }
  }
  return null;
}

export async function createCustomerControlNumber(params: {
  orderReference: string;
  amount: number;
  customerName?: string;
  customerEmail?: string | null;
  customerPhone?: string;
}) {
  const token = await getToken();
  const requestBody: Record<string, unknown> = {
    billReference: params.orderReference,
    billAmount: params.amount,
    billDescription: `School fees — ref ${params.orderReference}`,
    billPaymentMode: "ALLOW_PARTIAL_AND_OVER_PAYMENT",
    customerName: params.customerName || "Parent",
  };
  if (params.customerEmail) requestBody.customerEmail = params.customerEmail;
  if (params.customerPhone?.replace(/^\+/, "").trim()) {
    requestBody.customerPhone = params.customerPhone.replace(/^\+/, "").trim();
  }

  console.log("[clickpesa] BillPay request body:", requestBody);
  const response = await fetch(
    `${API_BASE}/billpay/create-customer-control-number`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    }
  );
  const data = await response.json().catch(() => ({}));
  console.log("[clickpesa] BillPay response status:", response.status, data);
  if (!response.ok) {
    throw new Error(
      (data as { message?: string }).message || "Failed to create control number"
    );
  }
  const billPayNumber =
    (data as { billPayNumber?: string }).billPayNumber ||
    (data as { data?: { billPayNumber?: string } }).data?.billPayNumber;
  if (!billPayNumber) throw new Error("Missing billPayNumber in response");
  return { controlNumber: billPayNumber };
}

export async function createCheckoutLink(params: {
  orderReference: string;
  amount: number;
  description: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string;
  /** ClickPesa supports TZS and USD only */
  orderCurrency?: "TZS" | "USD";
}) {
  const token = await getToken();

  const orderRef = params.orderReference.replace(/[^a-zA-Z0-9]/g, "");
  if (orderRef.length < 4) {
    throw new Error("Invalid order reference for checkout");
  }

  const currency: "TZS" | "USD" =
    params.orderCurrency ??
    (process.env.CLICKPESA_ORDER_CURRENCY === "USD" ? "USD" : "TZS");

  const defaultPhone = process.env.CLICKPESA_DEFAULT_CUSTOMER_PHONE
    ?.replace(/^\+/, "")
    .trim();
  const phone =
    params.customerPhone?.replace(/^\+/, "").trim() || defaultPhone || "";

  const requestBody: Record<string, unknown> = {
    totalPrice: String(Number(params.amount)),
    orderReference: orderRef,
    orderCurrency: currency,
    description: params.description.slice(0, 500),
    customerName: params.customerName || "Parent",
  };

  if (params.customerEmail?.trim()) {
    requestBody.customerEmail = params.customerEmail.trim();
  }
  if (phone.length >= 9) {
    requestBody.customerPhone = phone;
  }

  if (!requestBody.customerEmail && !requestBody.customerPhone) {
    throw new Error(
      "Checkout needs customer email or phone — add email to the parent account or set CLICKPESA_DEFAULT_CUSTOMER_PHONE"
    );
  }

  const path = CHECKOUT_PATH.startsWith("/") ? CHECKOUT_PATH : `/${CHECKOUT_PATH}`;
  const url = `${API_BASE}${path}`;

  console.log("[clickpesa] Checkout POST", url);
  console.log("[clickpesa] Checkout request body:", requestBody);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await response.json().catch(() => ({}));
  console.log("[clickpesa] Checkout response status:", response.status, data);

  if (!response.ok) {
    const msg =
      (data as { message?: string }).message ||
      `Failed to create checkout link (HTTP ${response.status})`;
    throw new Error(msg);
  }

  const checkoutLink = extractCheckoutUrl(data);
  if (!checkoutLink) {
    throw new Error(
      "ClickPesa returned no checkout URL. Enable hosted checkout for this app in the ClickPesa dashboard, or check API response fields. Body: " +
        JSON.stringify(data).slice(0, 400)
    );
  }

  return { checkoutLink };
}
