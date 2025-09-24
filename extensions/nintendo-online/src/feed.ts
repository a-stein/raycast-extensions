import Parser from "rss-parser";

type RawFeedItem = Parser.Item & {
  creator?: string;
  "dc:creator"?: string;
};

export interface FeedItem {
  title: string;
  link: string;
  author?: string;
  published?: Date;
  contentSnippet?: string;
  content?: string;
}

const parser = new Parser<unknown, RawFeedItem>({
  customFields: {
    item: ["creator", "dc:creator"],
  },
});

export async function fetchFeedItems(
  feedUrl: string,
  limit = 20,
): Promise<FeedItem[]> {
  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const body = await response.text();
  const parsed = (await parser.parseString(body)) as Parser.Output<RawFeedItem>;
  const items = (parsed.items ?? []) as RawFeedItem[];

  return items.slice(0, limit).map((item: RawFeedItem) => ({
    title: item.title ?? "Untitled",
    link: item.link ?? feedUrl,
    author: item.creator || (item as RawFeedItem)["dc:creator"],
    published: item.isoDate ? new Date(item.isoDate) : undefined,
    contentSnippet: item.contentSnippet ?? item.summary ?? undefined,
    content: item.content ?? undefined,
  }));
}
