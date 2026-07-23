import DOMPurify from "dompurify";
import hljs from "highlight.js";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";

const markdownParser = new Marked(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code, language) {
      const normalized = language.trim().toLowerCase();

      if (normalized && hljs.getLanguage(normalized)) {
        return hljs.highlight(code, { language: normalized }).value;
      }

      // Do not run highlightAuto on generated contexts. It can be expensive
      // when a large fence has no language annotation.
      return hljs.highlight(code, { language: "plaintext" }).value;
    },
  }),
);

export function renderSafeMarkdown(markdown: string): string {
  const html = markdownParser.parse(markdown, {
    async: false,
    gfm: true,
  }) as string;

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["iframe", "object", "embed", "form", "script", "style"],
    FORBID_ATTR: ["style", "onerror", "onclick", "onload"],
  });
}

export const RENDERED_MARKDOWN_LIMIT = 5 * 1024 * 1024;
export const EDITOR_WARNING_LIMIT = 25 * 1024 * 1024;
