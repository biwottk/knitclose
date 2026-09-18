/**
 * Auth routes: sign up, log in, and "who am I".
 *
 * Sign-up creates a family and makes the creator its admin, which mirrors the
 * client's OnboardingScreen ("Create a New Family Circle"). Joining an existing
 * circle goes through an invitation token instead -- single-use and expiring, per
 * the security posture in docs/great_deeds_tech_stack.md.
 */
import type { FastifyInstance } from "fastify";
import { hashPassword, issueToken, verifyPassword } from "../auth.ts";
import { newId, query, queryOne, transaction } from "../db.ts";
import { authenticate } from "../access.ts";

interface Credentials {
  email?: string;
  password?: string;
  displayName?: string;
  familyName?: string;
  inviteToken?: string;
}

/**
 * Passwords are for grandparents as much as for us: a long minimum with no
 * character-class rules is both more usable and stronger than the classic
 * "8 chars with a symbol" that produces 'Passw0rd!'.
 */
const MIN_PASSWORD = 10;

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/signup", async (req, reply) => {
    const body = (req.body ?? {}) as Credentials;
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const displayName = body.displayName?.trim();

    if (!email || !email.includes("@")) {
      return reply.code(400).send({ error: "a valid email is required" });
    }
    if (password.length < MIN_PASSWORD) {
      return reply.code(400).send({ error: `password must be at least ${MIN_PASSWORD} characters` });
    }
    if (!displayName) {
      return reply.code(400).send({ error: "displayName is required" });
    }

    const existing = await queryOne(`SELECT 1 FROM users WHERE lower(email) = $1`, [email]);
    if (existing) {
      return reply.code(409).send({ error: "an account with this email already exists" });
    }

    const passwordHash = await hashPassword(password);

    const result = await transaction(async (client) => {
      const userId = newId("u");
      await client.query(
        `INSERT INTO users (id, email, password_hash, display_name) VALUES ($1, $2, $3, $4)`,
        [userId, email, passwordHash, displayName],
      );

      /**
       * Two paths: redeem an invitation, or found a new circle.
       *
       * Redemption is guarded by 'FOR UPDATE' and a used_at check inside the
       * transaction, which is what makes a single-use token actually single-use when
       * two people tap the same link at the same moment.
       */
      if (body.inviteToken) {
        const invite = await client.query<{ family_id: string; role: string }>(
          `SELECT family_id, role FROM invitations
             WHERE token = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
             FOR UPDATE`,
          [body.inviteToken],
        );
        if (invite.rowCount === 0) {
          throw Object.assign(new Error("invitation is invalid, used, or expired"), { statusCode: 400 });
        }
        const { family_id, role } = invite.rows[0];

        // A joining member gets a person row so they can author and be referenced.
        const personId = newId("p");
        await client.query(
          `INSERT INTO people (id, family_id, name, is_living) VALUES ($1, $2, $3, true)`,
          [personId, family_id, displayName],
        );
        await client.query(
          `INSERT INTO memberships (user_id, family_id, role, person_id) VALUES ($1, $2, $3, $4)`,
          [userId, family_id, role, personId],
        );
        await client.query(`UPDATE invitations SET used_at = now() WHERE token = $1`, [body.inviteToken]);

        return { userId, familyId: family_id, personId, role: role as "admin" | "member" | "child" };
      }

      const familyId = newId("f");
      await client.query(
        `INSERT INTO families (id, name) VALUES ($1, $2)`,
        [familyId, body.familyName?.trim() || `${displayName}'s Family`],
      );
      const personId = newId("p");
      await client.query(
        `INSERT INTO people (id, family_id, name, is_living) VALUES ($1, $2, $3, true)`,
        [personId, familyId, displayName],
      );
      // The founder is the admin: somebody has to be able to invite the rest.
      await client.query(
        `INSERT INTO memberships (user_id, family_id, role, person_id) VALUES ($1, $2, 'admin', $3)`,
        [userId, familyId, personId],
      );

      return { userId, familyId, personId, role: "admin" as const };
    });

    return reply.code(201).send({
      token: issueToken({
        sub: result.userId, fam: result.familyId, pid: result.personId, role: result.role,
      }),
      user: { id: result.userId, name: displayName, role: result.role, personId: result.personId },
    });
  });

  app.post("/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as Credentials;
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return reply.code(400).send({ error: "email and password are required" });
    }

    const user = await queryOne<{ id: string; password_hash: string; display_name: string }>(
      `SELECT id, password_hash, display_name FROM users WHERE lower(email) = $1`,
      [email],
    );

    /**
     * One message for "no such user" and "wrong password", and the hash is still
     * verified against a dummy when the user is absent. Otherwise the response time
     * reveals which emails have accounts -- for a private family app, the mere fact
     * that an address is registered is itself information worth protecting.
     */
    const stored = user?.password_hash
      ?? "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA";
    const ok = await verifyPassword(password, stored);
    if (!user || !ok) {
      return reply.code(401).send({ error: "incorrect email or password" });
    }

    // A user may belong to several families; the most recently joined is the
    // sensible default until the client offers a switcher.
    const membership = await queryOne<{
      family_id: string; role: "admin" | "member" | "child"; person_id: string | null;
    }>(
      `SELECT family_id, role, person_id FROM memberships
         WHERE user_id = $1 ORDER BY joined_at DESC LIMIT 1`,
      [user.id],
    );

    if (!membership) {
      return reply.code(403).send({ error: "this account is not in a family circle yet" });
    }

    return reply.send({
      token: issueToken({
        sub: user.id, fam: membership.family_id,
        pid: membership.person_id, role: membership.role,
      }),
      user: {
        id: user.id, name: user.display_name,
        role: membership.role, personId: membership.person_id,
      },
    });
  });

  /** Bootstrap for a client holding a token: who am I, and which family am I in. */
  app.get("/auth/me", async (req, reply) => {
    const caller = await authenticate(req, reply);
    if (!caller) return;

    const rows = await query<{ display_name: string; family_name: string; plan: string }>(
      `SELECT u.display_name, f.name AS family_name, f.plan
         FROM users u
         JOIN memberships m ON m.user_id = u.id
         JOIN families f ON f.id = m.family_id
        WHERE u.id = $1 AND f.id = $2`,
      [caller.userId, caller.familyId],
    );
    if (rows.length === 0) return reply.code(404).send({ error: "not found" });

    return reply.send({
      user: {
        id: caller.userId, name: rows[0].display_name,
        role: caller.role, personId: caller.personId,
      },
      family: { id: caller.familyId, name: rows[0].family_name, plan: rows[0].plan },
    });
  });
}
