import { SCHOOL_CURRENCY_OPTIONS } from "@/lib/currency";

interface SchoolCurrencySelectProps {
  id: string;
  name?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Native select for school currency (TZS, KES, UGX, USD).
 */
export function SchoolCurrencySelect({
  id,
  name = "currency",
  defaultValue = "KES",
  required,
  disabled,
  className,
}: SchoolCurrencySelectProps) {
  return (
    <select
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      defaultValue={defaultValue}
      className={
        className ??
        "mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-school-primary focus:outline-none focus:ring-1 focus:ring-school-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-school-primary dark:focus:ring-school-primary"
      }
    >
      {SCHOOL_CURRENCY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
