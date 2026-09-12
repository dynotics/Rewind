const PAGE_SIZE = "100";
const RATE_LIMIT_STATUS = 429;
const RATE_LIMIT_DELAY_MS = 1000;

type PageInfo = { next_page_token?: string | null };
type PagedResponse = Record<string, unknown> & { page?: PageInfo };

export async function fetchAll<T>(
  path: string,
  params: Record<string, string>,
): Promise<T[]> {
  const resource = path.replace(/^\//, "");
  const items: T[] = [];
  let pageToken: string | undefined;

  const request = () => {
    const url = new URL(`${process.env.RHO_BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("page_size", PAGE_SIZE);
    if (pageToken) {
      url.searchParams.set("page_token", pageToken);
    }
    return fetch(url, {
      headers: { Authorization: `Bearer ${process.env.RHO_TOKEN}` },
    });
  };

  for (;;) {
    let response = await request();

    if (response.status === RATE_LIMIT_STATUS) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      response = await request();
    }

    if (!response.ok) {
      throw new Error(`Rho request to ${path} failed with status ${response.status}`);
    }

    const body = (await response.json()) as PagedResponse;
    const batch = body[resource];
    if (Array.isArray(batch)) {
      items.push(...(batch as T[]));
    }

    const nextPageToken = body.page?.next_page_token;
    if (!nextPageToken) {
      return items;
    }
    pageToken = nextPageToken;
  }
}
