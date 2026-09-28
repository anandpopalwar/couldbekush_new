/**
 * Hands the name of the destination across a route change.
 *
 * The covering slide starts on the page you are leaving and finishes on the one
 * you are arriving at, so the name painted on it has to survive the boundary.
 * The template that finishes the transition wraps `children` generically and
 * has no idea which project it is showing, so the page that started the
 * navigation leaves the label here on its way out.
 *
 * Module state, which is the right scope for this: it lives exactly as long as
 * the client-side session, and a hard page load — where there is no outgoing
 * animation to continue — starts empty, which is the correct answer.
 *
 * Stored with its href rather than alone. A navigation that doesn't set a label
 * (the Next-project link on a case study, say) would otherwise inherit whatever
 * was left from last time; comparing the href means a stale label can never be
 * mistaken for a current one.
 */

let pending: { href: string; label: string } | null = null;

export function setPendingTransition(href: string, label: string) {
  pending = { href, label };
}

/** The label for this path, or null if the arrival wasn't announced. */
export function getPendingLabel(pathname: string): string | null {
  return pending && pending.href === pathname ? pending.label : null;
}
