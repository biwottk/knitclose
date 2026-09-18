/**
 * Display-name helpers.
 *
 * Family names are not "first last". They are "Nana Ruth", "Uncle Dave", "Aunt
 * Claire", "Great Grandma Ida" -- the honorific IS part of what the family calls
 * them, and it is often the more important half. A naive `split(" ")[0]` turns a
 * member list into "Sarah, Aunt, Uncle, Marcus", which is both wrong and faintly
 * insulting.
 *
 * So there are two different jobs here, and they need different functions.
 */

/** Honorifics that are part of the name rather than the given name. */
const HONORIFICS = [
  "Great Grandma", "Great Grandpa", "Great Aunt", "Great Uncle",
  "Grandma", "Grandpa", "Granny", "Grandad", "Nana", "Nan",
  "Aunt", "Auntie", "Uncle", "Mum", "Mom", "Dad", "Papa", "Mama",
];

/**
 * The short form used in tight spots: chips, member lists, rota rows.
 *
 * Keeps the honorific attached when there is one ("Aunt Claire" stays "Aunt
 * Claire", because "Claire" alone may not be who the family means), and
 * otherwise drops the surname ("Sarah Miller" -> "Sarah").
 */
export function shortName(full: string): string {
  const honorific = HONORIFICS.find((h) => full.startsWith(h + " "));
  if (honorific) {
    const given = full.slice(honorific.length + 1).split(" ")[0];
    return given ? honorific + " " + given : honorific;
  }
  return full.split(" ")[0];
}

/**
 * The given name only, honorific stripped -- for when you are addressing someone
 * directly and the title would read as stiff ("Ruth's Circle", not "Nana Ruth's
 * Circle", where the possessive already carries the relationship).
 */
export function givenName(full: string): string {
  const honorific = HONORIFICS.find((h) => full.startsWith(h + " "));
  const rest = honorific ? full.slice(honorific.length + 1) : full;
  return rest.split(" ")[0] || full;
}

/** Up to two initials, honorific ignored so "Nana Ruth" is not "NR". */
export function initials(full: string): string {
  const honorific = HONORIFICS.find((h) => full.startsWith(h + " "));
  const rest = honorific ? full.slice(honorific.length + 1) : full;
  return rest
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
