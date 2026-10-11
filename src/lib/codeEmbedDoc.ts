// No network but https images and fonts: nothing pasted into a Code Embed can
// call an API or load a script from elsewhere.
const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; font-src https:;";

type CodeEmbedSource = { html?: string | null; css?: string | null; js?: string | null };

/**
 * The whole document a Code Embed's iframe runs, for `srcDoc`. The frame is
 * the only place this code is ever executed.
 *
 * A closing tag inside the CSS or the JS would end its element early and spill
 * the rest into the page as markup, so both are escaped.
 */
export function codeEmbedDoc({ html, css, js }: CodeEmbedSource) {
  const style = (css ?? "").replace(/<\/style/gi, "<\\/style");
  const script = (js ?? "").replace(/<\/script/gi, "<\\/script");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<style>body{margin:0;padding:16px;font-family:system-ui,sans-serif}</style>
<style>${style}</style>
</head>
<body>
${html ?? ""}
<script>${script}</script>
</body>
</html>`;
}
