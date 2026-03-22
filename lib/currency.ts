/**
 * School fee currencies — must match DB `schools.currency` check constraint.
 */
export const SCHOOL_CURRENCIES = ["TZS", "KES", "UGX", "USD"] as const;

export type SchoolCurrencyCode = (typeof SCHOOL_CURRENCIES)[number];

export const DEFAULT_SCHOOL_CURRENCY: SchoolCurrencyCode = "KES";

const LOCALE_BY_CODE: Record<SchoolCurrencyCode, string> = {
  TZS: "sw-TZ",
  KES: "en-KE",
  UGX: "en-UG",
  USD: "en-US",
};

/** Human-readable labels for selects */
export const SCHOOL_CURRENCY_OPTIONS: {
  value: SchoolCurrencyCode;
  label: string;
}[] = [
  { value: "TZS", label: "TZS — Tanzanian Shilling" },
  { value: "KES", label: "KES — Kenyan Shilling" },
  { value: "UGX", label: "UGX — Ugandan Shilling" },
  { value: "USD", label: "USD — US Dollar" },
];

export function isSchoolCurrencyCode(
  value: string | null | undefined
): value is SchoolCurrencyCode {
  return SCHOOL_CURRENCIES.includes(
    String(value ?? "").toUpperCase().trim() as SchoolCurrencyCode
  );
}

/** Coerce unknown DB/app values to a supported code (fallback KES). */
export function normalizeSchoolCurrency(
  value: string | null | undefined
): SchoolCurrencyCode {
  const u = String(value ?? "").toUpperCase().trim();
  if (isSchoolCurrencyCode(u)) return u;
  return DEFAULT_SCHOOL_CURRENCY;
}

/**
 * Format a monetary amount for display using the school's currency.
 * Uses Intl with locales: TZS sw-TZ, KES en-KE, UGX en-UG, USD en-US.
 */
export function formatCurrency(
  amount: number,
  currencyCode: string | null | undefined,
  options?: Intl.NumberFormatOptions
): string {
  const code = normalizeSchoolCurrency(currencyCode);
  const locale = LOCALE_BY_CODE[code];
  const fraction =
    code === "USD"
      ? { minimumFractionDigits: 0, maximumFractionDigits: 2 }
      : { minimumFractionDigits: 0, maximumFractionDigits: 0 };

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    ...fraction,
    ...options,
  }).format(amount);
}

/** Short code for headers, e.g. `Mount Zion (KES)`. */
export function formatSchoolTitleWithCurrency(
  schoolName: string,
  currencyCode: string | null | undefined
): string {
  const code = normalizeSchoolCurrency(currencyCode);
  return `${schoolName} (${code})`;
}

/** ClickPesa checkout supports only these order currencies. */
export function isClickPesaOrderCurrency(
  code: string | null | undefined
): code is "TZS" | "USD" {
  const c = normalizeSchoolCurrency(code);
  return c === "TZS" || c === "USD";
}

/**
 * Map school display currency to ClickPesa `orderCurrency` when school uses KES/UGX.
 * Does not convert amounts — caller should warn the user.
 */
export function resolveClickPesaOrderCurrency(
  schoolCurrency: string | null | undefined
): "TZS" | "USD" {
  const c = normalizeSchoolCurrency(schoolCurrency);
  if (c === "USD") return "USD";
  if (c === "TZS") return "TZS";
  if (process.env.CLICKPESA_ORDER_CURRENCY === "USD") return "USD";
  return "TZS";
}
