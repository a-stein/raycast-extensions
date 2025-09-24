export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  const units: { unit: Intl.RelativeTimeFormatUnit; value: number }[] = [
    { unit: "year", value: diffMinutes / (60 * 24 * 365) },
    { unit: "month", value: diffMinutes / (60 * 24 * 30) },
    { unit: "day", value: diffMinutes / (60 * 24) },
    { unit: "hour", value: diffMinutes / 60 },
    { unit: "minute", value: diffMinutes },
  ];

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const { unit, value } of units) {
    const rounded = Math.round(value);
    if (Math.abs(rounded) >= 1) {
      return formatter.format(rounded, unit);
    }
  }

  return formatter.format(0, "minute");
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function htmlToMarkdown(html: string): string {
  if (!html) return "";

  const wrapInline = (content: string, marker: string): string => {
    const leadingWhitespace = content.match(/^\s*/)?.[0] ?? "";
    const trailingWhitespace = content.match(/\s*$/)?.[0] ?? "";
    let trimmed = content.trim();
    if (!trimmed) {
      return content;
    }

    let trailingDashes = "";
    while (/[\-\u2010-\u2015]$/.test(trimmed)) {
      trailingDashes = trimmed.slice(-1) + trailingDashes;
      trimmed = trimmed.slice(0, -1).trimEnd();
    }

    if (!trimmed) {
      // If the content was only punctuation, fall back to the original value.
      return content;
    }

    return `${leadingWhitespace}${marker}${trimmed}${marker}${trailingDashes}${trailingWhitespace}`;
  };

  const escapeHtmlAttribute = (value: string): string => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  const escapeMarkdownText = (value: string): string => {
    return value.replace(/([\\`*_{}\[\]()#+.!|-])/g, "\\$1");
  };

  return html
    // Convert HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Custom handling for quoted forum posts (needs raw structure)
    .replace(/<aside[^>]*class="[^"]*quote[^"]*"[^>]*>([\s\S]*?)<\/aside>/gi, (_match: string, content: string) => {
      const titleMatch = content.match(/<div[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>(?=\s*<blockquote)/i);
      const blockMatch = content.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);

      let avatarUrl = "";
      let username = "";

      if (titleMatch) {
        const titleHtml = titleMatch[1];
        const avatarMatch = titleHtml.match(/<img[^>]*src\s*=\s*(["'])(.*?)\1/i);
        if (avatarMatch) {
          avatarUrl = avatarMatch[2].trim();
        }

        username = titleHtml
          .replace(/<img[^>]*>/gi, "")
          .replace(/<[^>]*>/g, "")
          .replace(/[:：]\s*$/, "")
          .trim();
      }

      if (!avatarUrl) {
        const fallbackAvatarMatch = content.match(/<img[^>]*class="[^"]*avatar[^"]*"[^>]*src\s*=\s*(["'])(.*?)\1/i);
        if (fallbackAvatarMatch) {
          avatarUrl = fallbackAvatarMatch[2].trim();
        }
      }

      if (!username) {
        const dataUserMatch = content.match(/data-user="([^"]+)"/i);
        if (dataUserMatch) {
          username = dataUserMatch[1].trim();
        }
      }

      const headerParts: string[] = [];

      if (avatarUrl) {
        let encodedAvatar = avatarUrl;
        try {
          encodedAvatar = encodeURI(avatarUrl);
        } catch {
          encodedAvatar = avatarUrl;
        }

        const altText = escapeMarkdownText(username || "Avatar");
        headerParts.push(`![${altText}](${encodedAvatar})`);
      }

      if (username) {
        headerParts.push(`**${escapeMarkdownText(username)}**`);
      }

      const quoteContent = blockMatch ? htmlToMarkdown(blockMatch[1]) : "";

      const quoteLines: string[] = [];
      if (quoteContent) {
        const normalizedQuote = quoteContent.replace(/\n{3,}/g, "\n\n");
        let previousWasBlank = false;
        for (const line of normalizedQuote.split(/\r?\n/)) {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) {
            if (!previousWasBlank) {
              quoteLines.push("> ");
              previousWasBlank = true;
            }
            continue;
          }

          quoteLines.push(`> ${trimmedLine}`);
          previousWasBlank = false;
        }
      }

      const sections: string[] = [];
      if (headerParts.length > 0) {
        sections.push(headerParts.join("\n"));
      }
      if (quoteLines.length > 0) {
        sections.push(quoteLines.join("\n"));
      }

      const combined = sections.join("\n");
      return combined.length > 0 ? `\n\n${combined}\n\n` : "\n\n";
    })
    // Treat block-level containers as paragraph breaks before inline conversion
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<(?:p|div|section|article|header|footer|figure)[^>]*>/gi, "\n\n")
    .replace(/<\/(?:p|div|section|article|header|footer|figure)>/gi, "\n\n")
    // Headings need surrounding blank lines to render correctly
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match: string, level: string, content: string) => {
      const prefix = "#".repeat(Number(level));
      return `\n\n${prefix} ${content.trim()}\n\n`;
    })
    // Convert inline formatting tags
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_match: string, content: string) => wrapInline(content, "**"))
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_match: string, content: string) => wrapInline(content, "**"))
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_match: string, content: string) => wrapInline(content, "*"))
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_match: string, content: string) => wrapInline(content, "*"))
    .replace(/<u[^>]*>([\s\S]*?)<\/u>/gi, "$1")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<img\b[^>]*>/gi, (match: string) => {
      const srcMatch = match.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
      if (!srcMatch) {
        return "";
      }

      const rawSrc = srcMatch[2].trim();
      if (!rawSrc) {
        return "";
      }

      const altMatch = match.match(/\balt\s*=\s*(["'])(.*?)\1/i);
      const titleMatch = match.match(/\btitle\s*=\s*(["'])(.*?)\1/i);
      const dataNameMatch = match.match(/\bdata-(?:emoji-name|emoji-shortname)\s*=\s*(["'])(.*?)\1/i);

      const altText = altMatch ? altMatch[2].trim() : "";
      const fallbackText = titleMatch ? titleMatch[2].trim() : dataNameMatch ? dataNameMatch[2].trim() : "";

      let encodedSrc = rawSrc;
      try {
        encodedSrc = encodeURI(rawSrc);
      } catch {
        encodedSrc = rawSrc;
      }

      if (/\/emoji\//i.test(rawSrc)) {
        const label = altText || fallbackText || "";
        const escapedLabel = escapeHtmlAttribute(label);
        return `<img src="${encodedSrc}" alt="${escapedLabel}" height="18" style="height:18px;width:auto;vertical-align:text-bottom;" />`;
      }

      const safeAlt = altText.replace(/([\[\]])/g, "\\$1");
      return `![${safeAlt}](${encodedSrc})`;
    })
    // Lists
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_match: string, content: string) => {
      const items = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_liMatch: string, li: string) => `- ${li.trim()}\n`);
      return `\n\n${items.trimEnd()}\n\n`;
    })
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_match: string, content: string) => {
      let counter = 1;
      const items = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_liMatch: string, li: string) => `${counter++}. ${li.trim()}\n`);
      return `\n\n${items.trimEnd()}\n\n`;
    })
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    // Block quotes
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match: string, content: string) => {
      const lines = content
        .split(/\r?\n/)
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .map((line: string) => `> ${line}`)
        .join("\n");
      return lines ? `\n\n${lines}\n\n` : "";
    })
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "```\n$1\n```")
    // Remove any remaining HTML tags except images
    .replace(/<(?!img\b)[^>]*>/g, "")
    // Clean up whitespace artefacts
    .replace(/\u00A0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "")
    .trim();
}
