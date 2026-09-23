/**
 * The API client.
 *
 * This is the ONLY file in the app that knows the backend exists. Screens continue
 * to talk to the store; the store talks to this. That boundary is why swapping mock
 * data for Postgres did not require touching a single screen.
 *
 * Everything here returns the same shapes `src/types.ts` already describes, because
 * the server shapes rows to that contract (see server/src/shape.ts). The client did
 * not get rewritten around the database; the database was fitted to the client.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";
import Constants from "expo-constants";
import type {
  ArchivePhoto, CareCircle, CareTask, Comment, CurrentUser, Deed, DoctorNote,
  EmergencyCard, Family, FamilyEvent, FamilyObject, Letter, MealSlot, Medication,
  Message, Person, Recipe, Thread, VoiceRecording,
} from "./types";

/**
 * Where the API lives.
 *
 * A PHYSICAL PHONE CANNOT REACH 'localhost' -- that resolves to the phone itself, so
 * every request fails with a network error that looks like the server is down. Expo
 * serves the bundle from the dev machine, so the host it was fetched from is also the
 * host the API is on; deriving it means a device on the LAN works with no config.
 * EXPO_PUBLIC_API_URL overrides for a deployed backend.
 */
const PORT = 4001;

/**
 * The dev machine's hostname as seen from wherever this code is running.
 *
 * Returns undefined rather than guessing, so the caller decides what a failure means.
 */
function devServerHost(): string | undefined {
  /**
   * Expo's own answer, and the one to prefer: hostUri is the 'host:port' Expo Go
   * connected to, e.g. '192.168.68.52:8081'. It is populated in Expo Go and in dev
   * builds, and it is a documented field rather than an internal global.
   */
  const hostUri =
    Constants.expoConfig?.hostUri ??
    // Older/!expoConfig manifest shapes keep it in different places depending on how
    // the app was launched (Expo Go vs dev build vs tunnel).
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    (Constants.manifest2 as { extra?: { expoGo?: { debuggerHost?: string } } } | undefined)
      ?.extra?.expoGo?.debuggerHost;

  if (typeof hostUri === "string" && hostUri.length > 0) {
    // Strip any port and any scheme; we only want the host.
    const host = hostUri.replace(/^https?:\/\//, "").split(/[:/?]/)[0];
    if (host) return host;
  }

  /**
   * Fallback: ask React Native where the JS bundle was loaded from.
   *
   * scriptURL looks like 'http://192.168.68.52:8081/index.bundle?platform=ios', and
   * that host is by definition the machine serving the app -- which is the machine
   * running the API. Used via the public NativeModules surface rather than the deep
   * internal getDevServer path, which ships no type declarations.
   *
   * Wrapped in try/catch because this touches a native module: in an environment
   * without one (a test run) it throws, and a crash here would take the app down
   * before a single screen rendered.
   */
  try {
    const scriptUrl = (NativeModules as {
      SourceCode?: { getConstants?: () => { scriptURL?: string }; scriptURL?: string };
    }).SourceCode;
    const url = scriptUrl?.getConstants?.().scriptURL ?? scriptUrl?.scriptURL;

    if (typeof url === "string") {
      const host = /^https?:\/\/([^:/]+)/.exec(url)?.[1];
      // A production bundle loads from a file:// uri, which yields no host -- so this
      // correctly declines to answer rather than inventing 'localhost'.
      if (host) return host;
    }
  } catch {
    // No native module available; fall through.
  }

  return undefined;
}

/**
 * Where the API lives.
 *
 * ORDER MATTERS. An explicit override always wins, then the platform's own idea of
 * the host. 'localhost' is the LAST resort and is only ever correct on the machine
 * running the server -- on a phone it means the phone itself, which is exactly how
 * this presented as "the server is unreachable" while the server was healthy.
 */
function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  if (Platform.OS === "web") {
    // The web build runs in a browser, so its own hostname is the right answer --
    // including when that is a LAN IP because the page was opened from another device.
    if (typeof window !== "undefined" && window.location?.hostname) {
      return `${window.location.protocol}//${window.location.hostname}:${PORT}`;
    }
    return `http://localhost:${PORT}`;
  }

  return `http://${devServerHost() ?? "localhost"}:${PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

/**
 * Log the resolved URL once on a device.
 *
 * When the API is unreachable the single most useful fact is which address was tried,
 * and that is invisible from the phone. This one line is what turns "unreachable" into
 * a five-second diagnosis.
 */
if (__DEV__ && Platform.OS !== "web") {
  console.log(`[api] base URL: ${API_BASE_URL}`);
}

const TOKEN_KEY = "knitclose.token";

/**
 * The bearer token is cached in memory AND persisted.
 *
 * In memory because every request needs it and AsyncStorage is async; persisted so
 * closing the app does not log a grandparent out -- for this audience, an
 * unnecessary re-login is a support call.
 */
let token: string | null = null;

export async function loadStoredToken(): Promise<string | null> {
  if (token) return token;
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    // A device with storage unavailable should still work for the session.
    token = null;
  }
  return token;
}

async function setToken(value: string | null): Promise<void> {
  token = value;
  try {
    if (value) await AsyncStorage.setItem(TOKEN_KEY, value);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Non-fatal: the in-memory copy carries the session.
  }
}

/** Thrown for any non-2xx. `status` lets callers treat 401 as "log in again". */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string>; raw?: BodyInit } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.raw ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch (err) {
    /**
     * A transport failure is the most likely problem in development, and RN's bare
     * "Network request failed" sends people hunting in the wrong place -- it looks
     * like the server is down even when it is healthy.
     *
     * So the message names the address that was tried. That one detail is what makes
     * the difference visible between "the API is not running" and "the API is running
     * but I resolved the wrong host", which is a mistake this file has already made
     * once: a `??`/`?:` precedence bug silently resolved every device request to
     * localhost, i.e. to the phone itself.
     */
    const hint = /localhost|127\.0\.0\.1/.test(API_BASE_URL) && Platform.OS !== "web"
      ? " On a device, 'localhost' means the phone itself -- the dev server host could" +
        " not be detected. Set EXPO_PUBLIC_API_URL to your machine's LAN IP."
      : " Is the API running? Try: npm run backend";

    throw new ApiError(0, `Cannot reach the server at ${API_BASE_URL}.${hint} (${(err as Error).message})`);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const payload = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const message = (payload as { error?: string })?.error ?? `request failed (${res.status})`;
    // An expired or revoked token must not leave a stale credential behind.
    if (res.status === 401) await setToken(null);
    throw new ApiError(res.status, message);
  }

  return payload as T;
}

/**
 * POST a local file by uri, streamed by the native layer (see `uploadMedia`).
 *
 * Deliberately mirrors `request`: same base URL, same bearer header, same ApiError on a
 * non-2xx, same "cannot reach the server at <address>" message on a transport failure.
 * A second HTTP path that reports errors differently would be a support headache.
 *
 * Uses XMLHttpRequest rather than fetch because RN's XHR is the layer that understands a
 * `{ uri }` body; its fetch polyfill stringifies unknown body objects.
 */
function uploadByUri<T>(path: string, uri: string, headers: Record<string, string>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    if (token) xhr.setRequestHeader("authorization", `Bearer ${token}`);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);

    xhr.onload = () => {
      let payload: unknown;
      try { payload = xhr.responseText ? JSON.parse(xhr.responseText) : undefined; } catch { payload = undefined; }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(payload as T);
      const message = (payload as { error?: string })?.error ?? `upload failed (${xhr.status})`;
      if (xhr.status === 401) void setToken(null);
      reject(new ApiError(xhr.status, message));
    };
    xhr.onerror = () => reject(new ApiError(0,
      `Cannot reach the server at ${API_BASE_URL} to upload the photo. Is the API running?`));
    xhr.ontimeout = () => reject(new ApiError(0, "The upload took too long. Please try again."));

    // RN-specific body shape: the native side opens the file and streams it.
    xhr.send({ uri } as unknown as XMLHttpRequestBodyInit);
  });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface Session {
  user: CurrentUser;
  family: Family;
}

interface AuthResponse {
  token: string;
  user: { id: string; name: string; role: CurrentUser["role"]; personId: string | null };
}

export const api = {
  hasToken: () => Boolean(token),

  async login(email: string, password: string): Promise<AuthResponse["user"]> {
    const res = await request<AuthResponse>("/auth/login", {
      method: "POST", body: { email, password },
    });
    await setToken(res.token);
    return res.user;
  },

  async signup(input: {
    email: string; password: string; displayName: string;
    familyName?: string; inviteToken?: string;
  }): Promise<AuthResponse["user"]> {
    const res = await request<AuthResponse>("/auth/signup", { method: "POST", body: input });
    await setToken(res.token);
    return res.user;
  },

  async logout(): Promise<void> {
    await setToken(null);
  },

  /** Resume a persisted session. Returns null when there is no valid token. */
  async me(): Promise<Session | null> {
    if (!(await loadStoredToken())) return null;
    try {
      const res = await request<{
        user: { id: string; name: string; role: CurrentUser["role"]; personId: string | null };
        family: Family;
      }>("/auth/me");
      return {
        user: { ...res.user, personId: res.user.personId ?? "" },
        family: res.family,
      };
    } catch (err) {
      // 401 already cleared the token; anything else (server down) is not a reason
      // to discard a session that may work in a moment.
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },

  // -------------------------------------------------------------------------
  // Family
  // -------------------------------------------------------------------------

  async renameFamily(name: string): Promise<Family> {
    return (await request<{ family: Family }>("/family", { method: "PATCH", body: { name } })).family;
  },

  async previewInvitation(token: string): Promise<{
    familyName: string; inviterName: string; role: string; expiresAt: string;
  }> {
    return request(`/family/invitations/${encodeURIComponent(token)}/preview`);
  },

  /** Redeem for the currently signed-in account and switch its active family token. */
  async redeemInvitation(token: string): Promise<void> {
    const result = await request<{ token: string; familyId: string }>(
      `/family/invitations/${encodeURIComponent(token)}/redeem`, { method: "POST" },
    );
    await setToken(result.token);
  },

  /** Mint a single-use invitation. Returns the token to put in a share sheet. */
  async createInvitation(role: "admin" | "member" | "child" = "member"): Promise<{ token: string; expiresInDays: number }> {
    return request<{ token: string; expiresInDays: number }>("/family/invitations", {
      method: "POST", body: { role },
    });
  },

  async members(): Promise<{ userId: string; name: string; role: string; personId: string | null }[]> {
    return (await request<{ members: { userId: string; name: string; role: string; personId: string | null }[] }>("/family/members")).members;
  },

  // -------------------------------------------------------------------------
  // People
  // -------------------------------------------------------------------------

  async people(): Promise<Person[]> {
    return (await request<{ people: Person[] }>("/people")).people;
  },

  async addPerson(input: {
    name: string; birthDate?: string; deathDate?: string; bio?: string;
    location?: string; isLiving?: boolean; parentIds?: string[]; spouseIds?: string[];
  }): Promise<string> {
    return (await request<{ id: string }>("/people", { method: "POST", body: input })).id;
  },

  async memorialise(personId: string): Promise<void> {
    await request(`/people/${personId}/memorialise`, { method: "POST" });
  },

  // -------------------------------------------------------------------------
  // Deeds
  // -------------------------------------------------------------------------

  async deeds(params: { personId?: string; limit?: number } = {}): Promise<Deed[]> {
    const q = new URLSearchParams();
    if (params.personId) q.set("personId", params.personId);
    if (params.limit) q.set("limit", String(params.limit));
    const suffix = q.toString() ? `?${q}` : "";
    return (await request<{ deeds: Deed[] }>(`/deeds${suffix}`)).deeds;
  },

  async deed(id: string): Promise<{ deed: Deed; comments: Comment[] }> {
    return request<{ deed: Deed; comments: Comment[] }>(`/deeds/${id}`);
  },

  async addDeed(input: {
    kind?: string;
    title: string; whenText: string; whenDate?: string; whereText?: string; story?: string;
    personIds?: string[]; tags?: string[]; mediaIds?: string[];
    audience?: string; audiencePersonIds?: string[];
    fromMessageId?: string; mayResurface?: boolean;
  }): Promise<string> {
    return (await request<{ id: string }>("/deeds", { method: "POST", body: input })).id;
  },

  async toggleReaction(deedId: string, kind: string): Promise<boolean> {
    return (await request<{ reacted: boolean }>(`/deeds/${deedId}/reactions`, {
      method: "POST", body: { kind },
    })).reacted;
  },

  async addComment(deedId: string, body: string, parentId?: string): Promise<string> {
    return (await request<{ id: string }>(`/deeds/${deedId}/comments`, {
      method: "POST", body: { body, parentId },
    })).id;
  },

  async flagDeed(deedId: string): Promise<void> {
    await request(`/deeds/${deedId}/flag`, { method: "POST" });
  },

  // -------------------------------------------------------------------------
  // Chat
  // -------------------------------------------------------------------------

  async threads(): Promise<Thread[]> {
    return (await request<{ threads: Thread[] }>("/threads")).threads;
  },

  async messages(threadId: string): Promise<Message[]> {
    return (await request<{ messages: Message[] }>(`/threads/${threadId}/messages`)).messages;
  },

  async createThread(input: { title?: string; kind?: string; audience?: string; memberIds?: string[] } = {}): Promise<string> {
    return (await request<{ id: string }>("/threads", { method: "POST", body: input })).id;
  },

  async sendMessage(threadId: string, input: { body?: string; mediaIds?: string[]; audioMediaId?: string }): Promise<string> {
    return (await request<{ id: string }>(`/threads/${threadId}/messages`, { method: "POST", body: input })).id;
  },

  // -------------------------------------------------------------------------
  // Care
  // -------------------------------------------------------------------------

  /** The whole Care tab in one round trip. */
  async care(): Promise<{
    circles: CareCircle[]; tasks: CareTask[]; medications: Medication[];
    mealSlots: MealSlot[]; doctorNotes: DoctorNote[]; emergencyCards: EmergencyCard[];
  }> {
    return request("/care");
  },

  async createCareCircle(input: { personId: string; status?: string; memberIds?: string[] }): Promise<string> {
    return (await request<{ id: string }>("/care/circles", { method: "POST", body: input })).id;
  },

  async claimCareTask(taskId: string): Promise<void> {
    await request(`/care/tasks/${taskId}/claim`, { method: "POST" });
  },

  async completeCareTask(taskId: string, result?: string): Promise<void> {
    await request(`/care/tasks/${taskId}/complete`, { method: "POST", body: { result } });
  },

  async claimMealSlot(slotId: string, title?: string): Promise<void> {
    await request(`/care/meals/${slotId}/claim`, { method: "POST", body: { title } });
  },

  // -------------------------------------------------------------------------
  // Archive + events
  // -------------------------------------------------------------------------

  async recipes(): Promise<Recipe[]> {
    return (await request<{ recipes: Recipe[] }>("/recipes")).recipes;
  },

  async addRecipe(input: {
    title: string; attribution: string; personId?: string; provenance?: string;
    origin?: string; originYear?: string; prepText?: string; yieldText?: string;
    ingredients?: string[]; steps?: string[]; tradition?: string;
    photoMediaId?: string; cardMediaId?: string;
  }): Promise<string> {
    return (await request<{ id: string }>("/recipes", { method: "POST", body: input })).id;
  },

  async toggleSaveRecipe(recipeId: string): Promise<boolean> {
    return (await request<{ saved: boolean }>(`/recipes/${recipeId}/save`, { method: "POST" })).saved;
  },

  async archivePhotos(): Promise<ArchivePhoto[]> {
    return (await request<{ photos: ArchivePhoto[] }>("/archive/photos")).photos;
  },

  async nameFace(faceId: string, name: string): Promise<void> {
    await request(`/archive/faces/${faceId}/name`, { method: "POST", body: { name } });
  },

  async addPhotoClue(photoId: string, body: string): Promise<void> {
    await request(`/archive/photos/${photoId}/clues`, { method: "POST", body: { body } });
  },

  // -------------------------------------------------------------------------
  // The Letter Box
  // -------------------------------------------------------------------------

  async letters(): Promise<Letter[]> {
    return (await request<{ letters: Letter[] }>("/letters")).letters;
  },

  async addLetter(input: {
    kind?: string; title: string; fromName?: string; fromPersonId?: string;
    toName?: string; toPersonId?: string; whenText?: string; whenDate?: string;
    transcript?: string; transcriptConfirmed?: boolean; provenance?: string;
    heldByName?: string; imageMediaId?: string; readingMediaId?: string;
    pageMediaIds?: string[]; audience?: string;
  }): Promise<string> {
    return (await request<{ id: string }>("/letters", { method: "POST", body: input })).id;
  },

  /** Correct or confirm a transcription -- the human-in-the-loop step. */
  async updateTranscript(letterId: string, input: { transcript?: string; confirmed?: boolean }): Promise<void> {
    await request(`/letters/${letterId}/transcript`, { method: "PATCH", body: input });
  },

  // -------------------------------------------------------------------------
  // Objects & Heirlooms
  // -------------------------------------------------------------------------

  async objects(): Promise<FamilyObject[]> {
    return (await request<{ objects: FamilyObject[] }>("/objects")).objects;
  },

  async addObject(input: {
    name: string; kind?: string; story?: string;
    originText?: string; originYear?: string; originPersonId?: string;
    heldByPersonId?: string; heldByName?: string; whereKept?: string;
    status?: string; statusNote?: string;
    imageMediaId?: string; photoMediaIds?: string[]; audience?: string;
  }): Promise<string> {
    return (await request<{ id: string }>("/objects", { method: "POST", body: input })).id;
  },

  /** Hand it on. Appends to the custody chain and moves the current holder. */
  async handOnObject(objectId: string, input: {
    personId?: string; holderName?: string; fromText?: string;
    fromDate?: string; note?: string; whereKept?: string;
  }): Promise<string> {
    return (await request<{ id: string }>(`/objects/${objectId}/custody`, {
      method: "POST", body: input,
    })).id;
  },

  async setObjectStatus(objectId: string, status: string, statusNote?: string): Promise<void> {
    await request(`/objects/${objectId}/status`, {
      method: "PATCH", body: { status, statusNote },
    });
  },

  // -------------------------------------------------------------------------
  // The Voice Vault
  // -------------------------------------------------------------------------

  /** Kept recordings, plus the prompts nobody has answered yet. */
  async voices(): Promise<{ voices: VoiceRecording[]; openPrompts: string[] }> {
    return request<{ voices: VoiceRecording[]; openPrompts: string[] }>("/voices");
  },

  /** Promote a recording into the vault. Idempotent: keeping twice is the same as once. */
  async keepVoice(input: {
    mediaId: string; title?: string; speakerName?: string; speakerPersonId?: string;
    prompt?: string; whenText?: string; fromMessageId?: string; audience?: string;
  }): Promise<string> {
    return (await request<{ id: string }>("/voices", { method: "POST", body: input })).id;
  },

  async events(): Promise<FamilyEvent[]> {
    return (await request<{ events: FamilyEvent[] }>("/events")).events;
  },

  async toggleRsvp(eventId: string): Promise<boolean> {
    return (await request<{ attending: boolean }>(`/events/${eventId}/rsvp`, { method: "POST" })).attending;
  },

  async claimPotluck(eventId: string, itemId: string): Promise<void> {
    await request(`/events/${eventId}/potluck/${itemId}/claim`, { method: "POST" });
  },

  async sendNudge(personId: string, action?: string): Promise<void> {
    await request("/nudges", { method: "POST", body: { personId, action } });
  },

  // -------------------------------------------------------------------------
  // Media
  // -------------------------------------------------------------------------

  /**
   * Upload one file.
   *
   * Takes a local uri (what expo-image-picker hands back) and posts the raw bytes.
   *
   * TWO PATHS, and the split is the fix for "uploading a photo fails":
   *
   * - NATIVE streams the file by uri through React Native's own XMLHttpRequest, which
   *   accepts `{ uri }` as a body and has the native side read the file directly. The
   *   previous approach -- `fetch(uri)` then `.blob()` -- is not reliable for local
   *   files: on Android `fetch('file://...')` rejects outright, and on iOS a Blob body
   *   lets the network layer substitute its own Content-Type, so the API answered 415
   *   even though the server was healthy. Streaming also avoids reading a 60-second
   *   video into JS memory (and avoids base64's 33% inflation).
   *
   * - WEB has no file:// uris -- the picker returns a blob: or data: url that
   *   `fetch` reads fine -- so the blob path stays for the browser only.
   */
  async uploadMedia(uri: string, contentType: string, durationSec?: number): Promise<{ id: string; uri: string }> {
    const headers: Record<string, string> = { "content-type": contentType };
    if (durationSec) headers["x-duration-sec"] = String(durationSec);

    if (Platform.OS === "web") {
      const fileRes = await fetch(uri);
      const blob = await fileRes.blob();
      return request<{ id: string; uri: string }>("/media", { method: "POST", headers, raw: blob });
    }

    return uploadByUri<{ id: string; uri: string }>("/media", uri, headers);
  },

  /** Re-sign an expired media URL without refetching its parent entity. */
  async mediaUrl(mediaId: string): Promise<string> {
    return (await request<{ uri: string }>(`/media/${mediaId}/url`)).uri;
  },
};
