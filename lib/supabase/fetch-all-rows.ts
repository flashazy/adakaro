type QueryPageResult<T> = {
  data: T[] | null;
  error: { message?: string | null } | null;
};

type FetchAllRowsParams<T> = {
  pageSize?: number;
  label: string;
  fetchPage: (from: number, to: number) => Promise<QueryPageResult<T>>;
};

/**
 * Fetches all rows from a Supabase select query using offset pagination.
 * Logs warnings on full pages and throws on query failures.
 */
export async function fetchAllRows<T>({
  pageSize = 1000,
  label,
  fetchPage,
}: FetchAllRowsParams<T>): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  let pageCount = 0;
  const maxPages = 100000;

  while (true) {
    pageCount += 1;
    if (pageCount > maxPages) {
      const msg = `[fetchAllRows] CRITICAL: exceeded max pages for ${label}`;
      console.error(msg);
      throw new Error(msg);
    }

    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      const msg = `[fetchAllRows] CRITICAL: failed while fetching ${label}: ${
        error.message ?? "Unknown error"
      }`;
      console.error(msg, error);
      throw new Error(msg);
    }

    const page = data ?? [];
    out.push(...page);

    if (page.length === pageSize) {
      console.warn(
        `WARNING: Query may have truncated results - increase limit or add pagination (${label}, pageSize=${pageSize}, from=${from})`
      );
    }

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return out;
}
