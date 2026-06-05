/**
 * Strip mention markup from text so it reads naturally in notification
 * snippets:
 *   @[usertag](user:usertag)              → @usertag
 *   /[communitytag](community:communitytag) → /communitytag
 *
 * Snippets stored on the BE carry markup so the original post can be
 * re-rendered with clickable mentions. In a notification preview we
 * just need the readable form.
 */
export function cleanMentionMarkup(content: string): string {
  if (!content) return content;
  return content
    .replace(/@\[([^\]]+)\]\(user:([^)]+)\)/g, "@$1")
    .replace(/\/\[([^\]]+)\]\(community:([^)]+)\)/g, "/$1");
}
