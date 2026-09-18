/**
 * Family settings and invitations.
 *
 * Both are admin-only: naming the circle and deciding who may enter it are the two
 * powers that make somebody the Family Champion, and the strategy doc treats that
 * role as the product's growth mechanism.
 */
import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { authenticate, requireAdmin } from "../access.ts";
import { query, queryOne } from "../db.ts";

/** Invitation lifetime. Long enough to reach a relative who checks email weekly. */
const INVITE_TTL_DAYS = 14;

export async function familyRoutes(app: FastifyInstance): Promise<void> {
  /** Rename the circle. This is what OnboardingScreen's "Create our circle" saves. */
  app.patch("/family", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    if (!(await requireAdmin(caller, reply))) return;

    const { name } = (req.body ?? {}) as { name?: string };
    const trimmed = name?.trim();
    if (!trimmed) return reply.code(400).send({ error: "name is required" });

    const row = await queryOne<{ id: string; name: string; plan: string }>(
      `UPDATE families SET name = $1 WHERE id = $2 RETURNING id, name, plan`,
      [trimmed, caller.familyId],
    );
    if (!row) return reply.code(404).send({ error: "family not found" });

    return reply.send({ family: row });
  });

  /**
   * Mint an invitation.
   *
   * Single-use, expiring and revocable, per the security posture. The token is 32
   * bytes of CSPRNG output rather than something memorable: an invitation IS the
   * credential that admits somebody to a family's private history, so it must not be
   * guessable. Redemption happens in /auth/signup, which marks it used inside the
   * same transaction that creates the membership.
   */
  app.post("/family/invitations", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    if (!(await requireAdmin(caller, reply))) return;

    const { role } = (req.body ?? {}) as { role?: string };
    const inviteRole = role ?? "member";
    if (!["admin", "member", "child"].includes(inviteRole)) {
      return reply.code(400).send({ error: "invalid role" });
    }

    const token = randomBytes(32).toString("base64url");
    await query(
      `INSERT INTO invitations (token, family_id, created_by, role, expires_at)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' days')::interval)`,
      [token, caller.familyId, caller.userId, inviteRole, String(INVITE_TTL_DAYS)],
    );

    return reply.code(201).send({ token, expiresInDays: INVITE_TTL_DAYS, role: inviteRole });
  });

  /** Revoke an unused invitation -- an invitation sent to the wrong address. */
  app.delete("/family/invitations/:token", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    if (!(await requireAdmin(caller, reply))) return;

    const { token } = req.params as { token: string };
    const rows = await query(
      `UPDATE invitations SET revoked_at = now()
         WHERE token = $1 AND family_id = $2 AND used_at IS NULL AND revoked_at IS NULL
       RETURNING token`,
      [token, caller.familyId],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "invitation not found or already used" });
    return reply.send({ ok: true });
  });

  /** The member list for Settings. */
  app.get("/family/members", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const members = await query<{
      user_id: string; display_name: string; role: string; person_id: string | null;
    }>(
      `SELECT m.user_id, u.display_name, m.role, m.person_id
         FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.family_id = $1 ORDER BY m.joined_at`,
      [caller.familyId],
    );

    return reply.send({
      members: members.map((m) => ({
        userId: m.user_id, name: m.display_name,
        role: m.role, personId: m.person_id,
      })),
    });
  });
}
