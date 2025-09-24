import { useEffect, useState } from "react";
import { Action, ActionPanel, Icon, List, Toast, showToast } from "@raycast/api";

import { FeedItem, fetchFeedItems } from "./feed";
import { formatLongDate, formatRelativeDate, htmlToMarkdown } from "./format";

interface ForumFeed {
  id: string;
  title: string;
  url: string;
  limit?: number;
  emptyTitle: string;
  emptyDescription: string;
}

const FORUM_FEEDS: ForumFeed[] = [
  {
    id: "posts",
    title: "Latest Posts",
    url: "https://forum.nintendo-online.de/posts.rss",
    limit: 30,
    emptyTitle: "No recent posts",
    emptyDescription: "No fresh replies have been published yet.",
  },
  {
    id: "latest",
    title: "Latest Topics",
    url: "https://forum.nintendo-online.de/latest.rss",
    limit: 30,
    emptyTitle: "No recent topics",
    emptyDescription: "There are no newly created topics right now.",
  },
  {
    id: "top",
    title: "Top Topics",
    url: "https://forum.nintendo-online.de/top.rss",
    limit: 20,
    emptyTitle: "No top topics",
    emptyDescription: "The forum has not highlighted top topics recently.",
  },
];

interface ForumSectionState {
  feed: ForumFeed;
  items: FeedItem[];
  error?: string;
}

interface FeedState {
  sections: ForumSectionState[];
  isLoading: boolean;
}

export default function ForumCommand() {
  const [state, setState] = useState<FeedState>({
    sections: FORUM_FEEDS.map((feed) => ({ feed, items: [] })),
    isLoading: true,
  });

  useEffect(() => {
    void loadFeed();
  }, []);

  async function loadFeed() {
    setState((previous) => ({
      ...previous,
      isLoading: true,
      sections: previous.sections.map((section) => ({ ...section, error: undefined })),
    }));

    const results = await Promise.allSettled(
      FORUM_FEEDS.map((feed) => fetchFeedItems(feed.url, feed.limit))
    );

    const sections: ForumSectionState[] = results.map((result, index) => {
      const feed = FORUM_FEEDS[index];
      if (result.status === "fulfilled") {
        return { feed, items: result.value };
      }

      const reason = result.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      return { feed, items: [], error: message };
    });

    setState({ sections, isLoading: false });

    const failedSection = sections.find((section) => section.error);
    if (failedSection) {
      await showToast(Toast.Style.Failure, "Unable to load forum feeds", failedSection.error);
    }
  }

  return (
    <List
      isLoading={state.isLoading}
      searchBarPlaceholder="Search Nintendo-Online forum topics"
      isShowingDetail
      throttle
    >
      {state.sections.map((section) => (
        <List.Section key={section.feed.id} title={section.feed.title}>
          {section.error ? (
            <List.Item
              title="Could not load feed"
              subtitle={section.error}
              icon={Icon.ExclamationMark}
              detail={
                <List.Item.Detail
                  markdown={`**${section.feed.title}**\\n\\n${section.error}`}
                />
              }
              actions={
                <ActionPanel>
                  <Action title="Retry" onAction={loadFeed} />
                </ActionPanel>
              }
            />
          ) : section.items.length === 0 ? (
            <List.Item
              title={section.feed.emptyTitle}
              subtitle={section.feed.emptyDescription}
              icon={Icon.Bubble}
              detail={
                <List.Item.Detail
                  markdown={`**${section.feed.title}**\\n\\n${section.feed.emptyDescription}`}
                />
              }
              actions={
                <ActionPanel>
                  <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={loadFeed} />
                </ActionPanel>
              }
            />
          ) : (
            section.items.map((item) => (
              <ForumListItem
                key={`${section.feed.id}-${item.link}`}
                item={item}
                onReload={loadFeed}
              />
            ))
          )}
        </List.Section>
      ))}
    </List>
  );
}

function ForumListItem({ item, onReload }: { item: FeedItem; onReload: () => void }) {
  const accessories = item.published
    ? [{ icon: Icon.Clock, text: formatRelativeDate(item.published) }]
    : undefined;

  const markdownParts = ["# " + item.title];
  if (item.content) {
    markdownParts.push(htmlToMarkdown(item.content));
  } else if (item.contentSnippet) {
    markdownParts.push(htmlToMarkdown(item.contentSnippet));
  }

  const keywords = [item.author, item.contentSnippet, item.content].filter(Boolean) as string[];

  return (
    <List.Item
      title={item.title}
      subtitle={item.author}
      accessories={accessories}
      keywords={keywords}
      icon={{ source: "assets/icon.png" }}
      detail={<List.Item.Detail markdown={markdownParts.join("\n\n")} />}
      actions={<ForumActions item={item} onReload={onReload} />}
    />
  );
}

function ForumActions({ item, onReload }: { item: FeedItem; onReload: () => void }) {
  return (
    <ActionPanel>
      <Action.OpenInBrowser url={item.link} />
      {item.published ? (
        <Action.CopyToClipboard
          title="Copy Publication Date"
          content={formatLongDate(item.published)}
        />
      ) : null}
      {item.author ? (
        <Action.CopyToClipboard title="Copy Author" content={item.author} />
      ) : null}
      <Action.CopyToClipboard title="Copy Link" content={item.link} shortcut={{ modifiers: ["cmd", "shift"], key: "c" }} />
      <Action title="Refresh" icon={Icon.ArrowClockwise} onAction={onReload} shortcut={{ modifiers: ["cmd"], key: "r" }} />
    </ActionPanel>
  );
}
