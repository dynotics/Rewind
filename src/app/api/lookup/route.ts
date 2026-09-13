import { tavily } from "@tavily/core";
import { NextResponse } from "next/server";
import { normalize } from "../../../lib/merchantLexicon";

const MAX_RESULTS = 3;

type LookupResult = { title: string; url: string; snippet: string };

export async function POST(request: Request) {
  let merchant: unknown;
  try {
    ({ merchant } = (await request.json()) as { merchant?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof merchant !== "string") {
    return NextResponse.json({ error: "merchant must be a string" }, { status: 400 });
  }

  const name = normalize(merchant);
  if (name.length === 0) {
    return NextResponse.json({ error: "merchant must not be empty" }, { status: 400 });
  }

  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY });
    const response = await client.search(`${name} official site`, { maxResults: MAX_RESULTS });

    const results: LookupResult[] = response.results
      .slice(0, MAX_RESULTS)
      .map((result) => ({ title: result.title, url: result.url, snippet: result.content }));

    return NextResponse.json({ name, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tavily request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
