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
import { newId, query, queryOne, transaction } from "../db.ts";
import { issueToken } from "../auth.ts";

/** Invitation lifetime. Long enough to reach a relative who checks email weekly. */
const INVITE_TTL_DAYS = 14;

export async function familyRoutes(app: FastifyInstance): Promise<void> {
  /** Public preview: identity needed for consent, never family content. */
  app.get("/family/invitations/:token/preview", async (req, reply) => {
    const { token } = req.params as { token: string };
    const invite = await queryOne<{
      family_name: string; inviter_name: string; role: string; expires_at: Date;
      used_at: Date | null; revoked_at: Date | null;
    }>(
      `SELECT f.name AS family_name, u.display_name AS inviter_name, i.role,
              i.expires_at, i.used_at, i.revoked_at
         FROM invitations i
         JOIN families f ON f.id = i.family_id
         JOIN users u ON u.id = i.created_by
        WHERE i.token = $1`,
      [token],
    );
    if (!invite || invite.used_at || invite.revoked_at || invite.expires_at <= new Date()) {
      return reply.code(404).send({ error: "invitation is invalid, used, or expired" });
    }
    return reply.send({
      familyName: invite.family_name, inviterName: invite.inviter_name, role: invite.role,
      expiresAt: invite.expires_at.toISOString(),
    });
  });

  /** Join this account to the invited family without deleting its existing circle. */
  app.post("/family/invitations/:token/redeem", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;
    const { token } = req.params as { token: string };
    const result = await transaction(async (client) => {
      const invite = await client.query<{ family_id: string; role: "admin" | "member" | "child" }>(
        `SELECT family_id, role FROM invitations
          WHERE token = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
          FOR UPDATE`,
        [token],
      );
      if (invite.rowCount === 0) {
        throw Object.assign(new Error("invitation is invalid, used, or expired"), { statusCode: 400 });
      }
      const target = invite.rows[0];
      if (target.family_id === caller.familyId) {
        throw Object.assign(new Error("you are already in this family circle"), { statusCode: 409 });
      }
      const existing = await client.query(
        `SELECT 1 FROM memberships WHERE user_id = $1 AND family_id = $2`,
        [caller.userId, target.family_id],
      );
      if (existing.rowCount) {
        throw Object.assign(new Error("you are already in this family circle"), { statusCode: 409 });
      }
      const user = await client.query<{ display_name: string }>(
        `SELECT display_name FROM users WHERE id = $1`, [caller.userId],
      );
      const personId = newId("p");
      await client.query(
        `INSERT INTO people (id, family_id, name, is_living) VALUES ($1, $2, $3, true)`,
        [personId, target.family_id, user.rows[0]?.display_name ?? "A family member"],
      );
      await client.query(
        `INSERT INTO memberships (user_id, family_id, role, person_id) VALUES ($1, $2, $3, $4)`,
        [caller.userId, target.family_id, target.role, personId],
      );
      await client.query(`UPDATE invitations SET used_at = now() WHERE token = $1`, [token]);
      return { familyId: target.family_id, personId, role: target.role };
    });
    return reply.send({
      token: issueToken({ sub: caller.userId, fam: result.familyId, pid: result.personId, role: result.role }),
      familyId: result.familyId,
    });
  });

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
