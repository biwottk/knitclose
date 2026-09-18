/**
 * THE SECURITY BOUNDARY.
 *
 * The old client filtered content by audience in its selectors. That was a good
 * pattern for a prototype and is an unacceptable one for a real backend: anybody
 * can call an HTTP API with their own client. The privacy promise in the README --
 * "visible only to the people in your family circle" -- has to be enforced here,
 * on the server, in SQL.
 *
 * Two predicates do almost all of the work:
 *
 *   1. FAMILY ISOLATION. Every query is scoped to the caller's family_id, taken
 *      from the verified token and never from the request body. A client cannot ask
 *      for another family's rows because it has no way to name one.
 *
 *   2. AUDIENCE. A child account must never receive 'adults' content (health,
 *      money, wills). This is a hard rule, not a preference, so it is expressed as
 *      a SQL fragment that is appended to every content query rather than as an
 *      if-statement a route can forget.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken, type TokenClaims } from "./auth.ts";
import { queryOne } from "./db.ts";

export interface Caller {
  userId: string;
  familyId: string;
  /** The person in the tree this user is. Null for an account not yet linked. */
  personId: string | null;
  role: "admin" | "member" | "child";
}

/**
 * Audience values this caller may see, as a literal list for SQL.
 *
 * 'care' and 'branch' are intentionally NOT granted wholesale here -- they are
 * scoped to a sub-circle, so the routes that serve them join through
 * care_circle_members / thread_members. This function answers only the question it
 * can answer globally, which is the adults/child distinction.
 */
export function visibleAudiences(caller: Caller): string[] {
  return caller.role === "child"
    ? ["everyone", "branch"]
    : ["everyone", "adults", "care", "branch"];
}

/**
 * Authenticate a request. Returns null and sends 401 when the token is missing or
 * invalid, so a route body can be written as:
 *
 *   const caller = await authenticate(req, reply);
 *   if (!caller) return;
 */
export async function authenticate(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<Caller | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    await reply.code(401).send({ error: "missing bearer token" });
    return null;
  }

  const claims: TokenClaims | null = verifyToken(header.slice(7));
  if (!claims) {
    await reply.code(401).send({ error: "invalid or expired token" });
    return null;
  }

  /**
   * The token is signed, but membership is re-checked against the database on every
   * request. A token outlives a change of circumstance: somebody removed from a
   * family, or demoted to a child account, must lose access immediately rather than
   * when their token happens to expire. This is the difference between a claim and
   * a fact.
   */
  const row = await queryOne<{ role: Caller["role"]; person_id: string | null }>(
    `SELECT role, person_id FROM memberships WHERE user_id = $1 AND family_id = $2`,
    [claims.sub, claims.fam],
  );

  if (!row) {
    await reply.code(403).send({ error: "not a member of this family" });
    return null;
  }

  return {
    userId: claims.sub,
    familyId: claims.fam,
    // Live values win over the token's copy, for the reason above.
    personId: row.person_id,
    role: row.role,
  };
}

/** Routes that mutate family settings or invite people. */
export async function requireAdmin(
  caller: Caller,
  reply: FastifyReply,
): Promise<boolean> {
  if (caller.role !== "admin") {
    await reply.code(403).send({ error: "admin role required" });
    return false;
  }
  return true;
}

/**
 * Adults-only gate for whole endpoints (the emergency card, medical detail).
 *
 * Some resources are not merely audience-tagged, they are categorically adult. The
 * emergency_cards table has no audience column for exactly this reason: there is no
 * legitimate value other than "adults", so it is enforced by the route instead of
 * being left as data somebody could set wrongly.
 */
export async function requireAdult(
  caller: Caller,
  reply: FastifyReply,
): Promise<boolean> {
  if (caller.role === "child") {
    await reply.code(403).send({ error: "not available to child accounts" });
    return false;
  }
  return true;
}
