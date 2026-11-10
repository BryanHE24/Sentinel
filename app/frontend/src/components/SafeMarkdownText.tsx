import type { ReactNode } from "react";

interface SafeMarkdownTextProps {
  content: string;
  className?: string;
}

const INLINE_TOKEN_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;

/**
 * Parse inline **bold**, *italic*, and `code` into React elements.
 * All text is rendered as React text nodes so raw HTML is never executed.
 */
function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(INLINE_TOKEN_PATTERN);
  return parts.filter(Boolean).map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={idx}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

type BlockNode =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function parseMarkdownBlocks(rawContent: string): BlockNode[] {
  const lines = rawContent.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let paragraphLines: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length > 0) {
      blocks.push({
        type: "paragraph",
        text: paragraphLines.join(" "),
      });
      paragraphLines = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const headingMatch = line.match(/^#{1,4}\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({ type: "heading", text: headingMatch[1].trim() });
      continue;
    }

    const ulMatch = line.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      const itemText = ulMatch[1].trim();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "ul") {
        prev.items.push(itemText);
      } else {
        blocks.push({ type: "ul", items: [itemText] });
      }
      continue;
    }

    const olMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      const itemText = olMatch[1].trim();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "ol") {
        prev.items.push(itemText);
      } else {
        blocks.push({ type: "ol", items: [itemText] });
      }
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  return blocks;
}

/**
 * Render basic Markdown (headings, paragraphs, lists, bold, italic, inline code)
 * safely as React elements with raw HTML disabled.
 */
export function SafeMarkdownText({
  content,
  className = "markdown-body",
}: SafeMarkdownTextProps) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={className}>
      {blocks.map((block, idx) => {
        if (block.type === "heading") {
          return (
            <h4 key={idx} className="markdown-heading">
              {renderInlineMarkdown(block.text)}
            </h4>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={idx} className="markdown-list">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={idx} className="markdown-list">
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={idx} className="markdown-paragraph">
            {renderInlineMarkdown(block.text)}
          </p>
        );
      })}
    </div>
  );
}
