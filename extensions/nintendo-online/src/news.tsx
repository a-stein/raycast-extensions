import { useEffect, useState } from "react";
import {
  Action,
  ActionPanel,
  Icon,
  List,
  Toast,
  showToast,
} from "@raycast/api";

import { FeedItem, fetchFeedItems } from "./feed";
import { formatLongDate, formatRelativeDate, htmlToMarkdown } from "./format";

const FEED_URL = "https://www.nintendo-online.de/rss.xml";

interface FeedState {
  items: FeedItem[];
  isLoading: boolean;
  error?: string;
}

export default function NewsCommand() {
  const [state, setState] = useState<FeedState>({ items: [], isLoading: true });

  useEffect(() => {
    void loadFeed();
  }, []);

  async function loadFeed() {
    setState((previous) => ({
      ...previous,
      isLoading: true,
      error: undefined,
    }));

    try {
      const items = await fetchFeedItems(FEED_URL);
      setState({ items, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setState({ items: [], isLoading: false, error: message });
      await showToast(Toast.Style.Failure, "Unable to load news", message);
    }
  }

  return (
    <List
      isLoading={state.isLoading}
      searchBarPlaceholder="Search Nintendo-Online Feed"
      isShowingDetail
      throttle
    >
      {state.error ? (
        <List.EmptyView
          title="Could not load Nintendo-Online Feed"
          description={state.error}
          icon={Icon.ExclamationMark}
          actions={
            <ActionPanel>
              <Action title="Retry" onAction={loadFeed} />
            </ActionPanel>
          }
        />
      ) : state.items.length === 0 ? (
        <List.EmptyView
          title="No articles available"
          description="Nintendo-Online.de has not published new content yet."
          icon={Icon.Book}
          actions={
            <ActionPanel>
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                onAction={loadFeed}
              />
            </ActionPanel>
          }
        />
      ) : (
        state.items.map((item) => <NewsListItem key={item.link} item={item} />)
      )}
    </List>
  );

  function NewsListItem({ item }: { item: FeedItem }) {
    const accessories = item.published
      ? [{ icon: Icon.Clock, text: formatRelativeDate(item.published) }]
      : undefined;

    const keywords = [item.author, item.contentSnippet, item.content].filter(
      Boolean,
    ) as string[];

    const markdownParts = ["# " + item.title];
    if (item.content) {
      markdownParts.push(htmlToMarkdown(item.content));
    } else if (item.contentSnippet) {
      markdownParts.push(htmlToMarkdown(item.contentSnippet));
    }

    const detailMarkdown = markdownParts.join("\n\n");

    return (
      <List.Item
        title={item.title}
        accessories={accessories}
        icon={{ source: "assets/icon.png" }}
        keywords={keywords}
        detail={<List.Item.Detail markdown={detailMarkdown} />}
        actions={<FeedActions item={item} onReload={loadFeed} />}
      />
    );
  }
}

function FeedActions({
  item,
  onReload,
}: {
  item: FeedItem;
  onReload: () => void;
}) {
  return (
    <ActionPanel>
      <Action.OpenInBrowser url={item.link} />
      {item.published ? (
        <Action.CopyToClipboard
          title="Copy Publication Date"
          content={formatLongDate(item.published)}
        />
      ) : null}
      <Action.CopyToClipboard
        title="Copy Link"
        content={item.link}
        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
      />
      <Action
        title="Refresh"
        icon={Icon.ArrowClockwise}
        onAction={onReload}
        shortcut={{ modifiers: ["cmd"], key: "r" }}
      />
    </ActionPanel>
  );
}
