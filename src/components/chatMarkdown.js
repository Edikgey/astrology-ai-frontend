import React from "react";

// A narrow subset of model markup for AI answers (DECISIONS №9 (а)), built only from React
// elements: paragraphs, line breaks, **bold**/__bold__, *italic*, "-"/"*"/"•" and "1."/"1)" lists,
// a "#" line as a bold paragraph. Links keep only their text, backticks and "---" are dropped.
// Everything else, HTML included, stays literal text: React escapes every string it renders.
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const HEADING = /^\s{0,3}#{1,6}(?:\s+|$)/;
const ORDERED = /^\s*(\d{1,3})[.)]\s+/;
const BULLET = /^\s*[-*•]\s+/;
// The URL part excludes "(" and ")" so an unclosed "[т](" never rescans the rest of the line.
const LINK = /!?\[([^[\]\n]*)\]\([^()\n]*\)/g;
// The inner text excludes its own delimiter, so an unclosed "**" or "*" fails fast and stays literal.
const INLINE = /\*\*([^*\s](?:[^*\n]*[^*\s])?)\*\*|__([^_\s](?:[^_\n]*[^_\s])?)__|\*([^*\s](?:[^*\n]*[^*\s])?)\*/g;

const clean = line => line.replace(LINK, "$1").replace(/`/g, "");

const inline = text => {
  const parts = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const Tag = match[3] === undefined ? "strong" : "em";
    parts.push(<Tag key={match.index}>{match[1] ?? match[2] ?? match[3]}</Tag>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const parse = text => {
  const blocks = [];
  let current = null;
  const add = (type, item, start) => {
    if (current?.type !== type) blocks.push(current = { type, items: [], start });
    current.items.push(item);
  };
  for (const line of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    let match;
    // A blank line or a rule ends a paragraph; a list may continue after it ("1. a\n\n2. b").
    if (!line.trim() || RULE.test(line)) { if (current?.type === "p") current = null; }
    else if ((match = line.match(ORDERED))) add("ol", clean(line.slice(match[0].length)), Number(match[1]));
    else if ((match = line.match(BULLET))) add("ul", clean(line.slice(match[0].length)));
    else if ((match = line.match(HEADING))) {
      const heading = clean(line.slice(match[0].length));
      if (heading.trim()) blocks.push({ type: "heading", items: [heading] });
      current = null;
    } else {
      const cleaned = clean(line);
      if (cleaned.trim()) add("p", cleaned);
    }
  }
  return blocks;
};

const ChatMarkdown = ({ text }) => <div className="chat-markdown">
  {parse(text).map((block, index) => {
    if (block.type === "heading") return <p key={index}><strong>{inline(block.items[0])}</strong></p>;
    if (block.type === "p") return <p key={index}>{block.items.map((line, lineIndex) =>
      <React.Fragment key={lineIndex}>{lineIndex > 0 && <br />}{inline(line)}</React.Fragment>)}</p>;
    const List = block.type;
    return <List key={index} start={block.start > 1 ? block.start : undefined}>
      {block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}
    </List>;
  })}
</div>;

export default ChatMarkdown;
