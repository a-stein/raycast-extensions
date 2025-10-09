import { useEffect } from "react";
import {
  Action,
  ActionPanel,
  Icon,
  List,
  Toast,
  showToast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";

import { FeedItem, fetchFeedItems } from "./feed";
import { formatLongDate, formatRelativeDate, htmlToMarkdown } from "./format";

const FEED_URL = "https://www.nintendo-online.de/rss.xml";

export default function NewsCommand() {
  const { data, error, isLoading, revalidate } = useCachedPromise(
    fetchFeedItems,
    [FEED_URL],
    {
      keepPreviousData: true,
    },
  );

  const items = data ?? [];
  const errorMessage =
    error instanceof Error ? error.message : error ? String(error) : undefined;

  // Surface loading errors via toast without discarding cached data
  useEffect(() => {
    if (!errorMessage) {
      return;
    }
    void showToast(Toast.Style.Failure, "Unable to load news", errorMessage);
  }, [errorMessage]);

  const reload = () => {
    void revalidate();
  };

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Search Nintendo-Online Feed"
      isShowingDetail
      throttle
    >
      {errorMessage ? (
        <List.EmptyView
          title="Could not load Nintendo-Online Feed"
          description={errorMessage}
          icon={Icon.ExclamationMark}
          actions={
            <ActionPanel>
              <Action title="Retry" onAction={reload} />
            </ActionPanel>
          }
        />
      ) : items.length === 0 ? (
        <List.EmptyView
          title="No articles available"
          description="Nintendo-Online.de has not published new content yet."
          icon={Icon.Book}
          actions={
            <ActionPanel>
              <Action
                title="Refresh"
                icon={Icon.ArrowClockwise}
                onAction={reload}
              />
            </ActionPanel>
          }
        />
      ) : (
        items.map((item) => (
          <NewsListItem key={item.link} item={item} onReload={reload} />
        ))
      )}
    </List>
  );

  function NewsListItem({
    item,
    onReload,
  }: {
    item: FeedItem;
    onReload: () => void;
  }) {
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
        actions={<FeedActions item={item} onReload={onReload} />}
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
