import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";
import type {
  ArchivePhoto, Audience, CareCircle, CareTask, Comment, CurrentUser, Deed,
  DoctorNote, EmergencyCard, Family, FamilyEvent, MealSlot, Medication, MemoryKind,
  Message, Person, ReactionKind, Recipe, Thread,
} from "./types";
import { canView } from "./types";
import { shortName } from "./names";
import { api, ApiError } from "./api";

/**
 * State lives in a Context + reducer. It is a small app; Redux would be overkill.
 *
 * THIS FILE IS THE DATA SEAM, and EVERY slice is now real.
 *
 * There is deliberately NO import of ./mockData here any more. That import was a
 * privacy bug, not a convenience: a family who had just signed up saw the Miller
 * fixture -- Nana's medication, Marcus's photos, somebody else's recipes -- inside
 * their own private circle. In an app whose entire promise is "visible only to the
 * people in your family circle", shipping another family's health data as a
 * placeholder is the worst thing the app could do.
 *
 * mockData.ts still exists, but only `server/src/seed.ts` may read it: it is a
 * DEVELOPMENT FIXTURE for seeding a database, never a runtime fallback.
 *
 * Mutations are OPTIMISTIC: the reducer updates immediately so the UI stays instant,
 * and the API call follows. On failure the action is reverted by re-fetching, because
 * for this product a wrong-but-fast archive is worse than a slow one -- the whole
 * value proposition is that what it says is true.
 *
 * Selectors remain the important part. They are the only place that knows about
 * audience filtering, so a screen physically cannot forget to apply it. Note that
 * this is now DEFENCE IN DEPTH rather than the enforcement point: the server filters
 * by audience in SQL (server/src/access.ts), so a compromised or buggy client cannot
 * obtain adults-only content in the first place.
 */

interface State {
  family: Family;
  currentUser: CurrentUser;
  people: Person[];
  deeds: Deed[];
  comments: Comment[];
  threads: Thread[];
  messages: Message[];
  careCircles: CareCircle[];
  careTasks: CareTask[];
  doctorNotes: DoctorNote[];
  medications: Medication[];
  mealSlots: MealSlot[];
  emergencyCards: EmergencyCard[];
  recipes: Recipe[];
  archivePhotos: ArchivePhoto[];
  events: FamilyEvent[];
  /** Warm pings sent this session, so the UI can confirm them without a backend. */
  sentNudges: string[];
  /**
   * Backend status for the server-backed slices.
   *
   * 'loading' on first fetch, 'error' when the API is unreachable. The UI needs to be
   * able to tell "this family has no stories yet" apart from "we could not reach the
   * server" -- showing the empty-state copy for a network failure would tell a family
   * their archive is gone, which is unforgivable in a product about permanence.
   */
  status: "loading" | "ready" | "error";
  errorMessage?: string;
}

type Action =
  // Server-backed slices arriving or failing.
  | { type: "hydrate"; data: Partial<State> }
  | { type: "loadFailed"; message: string }
  | { type: "addDeed"; deed: Deed }
  | { type: "toggleReaction"; deedId: string; kind: ReactionKind }
  | { type: "addComment"; comment: Comment }
  | { type: "addPerson"; person: Person }
  | { type: "flagDeed"; deedId: string }
  | { type: "setFamilyName"; name: string }
  // Speed 1: chat + quick shares
  | { type: "sendMessage"; message: Message }
  | { type: "reactToMessage"; messageId: string; emoji: string }
  | { type: "promoteMessage"; messageId: string; deed: Deed }
  // Care
  | { type: "claimCareTask"; taskId: string }
  | { type: "completeCareTask"; taskId: string; result?: string }
  | { type: "claimMealSlot"; slotId: string; title?: string }
  // Archive
  | { type: "nameFace"; photoId: string; faceId: string; name: string }
  | { type: "addPhotoClue"; photoId: string; body: string }
  | { type: "toggleSaveRecipe"; recipeId: string }
  // Coordination
  | { type: "toggleRsvp"; eventId: string }
  | { type: "claimPotluck"; eventId: string; itemId: string }
  | { type: "sendNudge"; personId: string }
  // Bereavement: irreversible by design, and it silences every nudge at once.
  | { type: "memorialise"; personId: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { ...state, ...action.data, status: "ready", errorMessage: undefined };

    case "loadFailed":
      return { ...state, status: "error", errorMessage: action.message };

    case "addDeed":
      return { ...state, deeds: [action.deed, ...state.deeds] };

    case "toggleReaction": {
      // personId, NOT currentUser.id: a reaction is authored by the PERSON in the
      // tree, which is what deed.reactions holds everywhere else and what the
      // backend's deed_reactions.person_id foreign key requires. These two id
      // spaces were previously mixed, so a user's own applaud did not read back as
      // "mine" and the API rejected the row outright.
      const uid = state.currentUser.personId;
      return {
        ...state,
        deeds: state.deeds.map((d) => {
          if (d.id !== action.deedId) return d;
          const current = d.reactions[action.kind] ?? [];
          const next = current.includes(uid)
            ? current.filter((x) => x !== uid)
            : [...current, uid];
          return { ...d, reactions: { ...d.reactions, [action.kind]: next } };
        }),
      };
    }

    case "addComment":
      return { ...state, comments: [...state.comments, action.comment] };

    case "addPerson":
      return { ...state, people: [...state.people, action.person] };

    case "setFamilyName":
      return { ...state, family: { ...state.family, name: action.name } };

    case "flagDeed":
      // Private: only admins are notified. No public "reported" badge -- see
      // docs/great_deeds_strategy.md section 4.
      return {
        ...state,
        deeds: state.deeds.map((d) =>
          d.id === action.deedId ? { ...d, flagged: true } : d),
      };

    // -- Speed 1 ------------------------------------------------------------

    case "sendMessage":
      return { ...state, messages: [...state.messages, action.message] };

    case "reactToMessage": {
      const uid = state.currentUser.personId;
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.id !== action.messageId) return m;
          const current = m.reactions?.[action.emoji] ?? [];
          const next = current.includes(uid)
            ? current.filter((x) => x !== uid)
            : [...current, uid];
          return { ...m, reactions: { ...m.reactions, [action.emoji]: next } };
        }),
      };
    }

    /**
     * The bridge between the two speeds: a throwaway message becomes a permanent
     * deed. The message keeps a pointer so the chat can show "in the archive"
     * rather than offering to promote it twice.
     */
    case "promoteMessage":
      return {
        ...state,
        deeds: [action.deed, ...state.deeds],
        messages: state.messages.map((m) =>
          m.id === action.messageId ? { ...m, promotedToDeedId: action.deed.id } : m),
      };

    // -- Care ---------------------------------------------------------------

    case "claimCareTask":
      return {
        ...state,
        careTasks: state.careTasks.map((t) =>
          t.id === action.taskId
            ? {
                ...t,
                claimedById: state.currentUser.personId,
                claimedByName: shortName(state.currentUser.name),
              }
            : t),
      };

    case "completeCareTask":
      return {
        ...state,
        careTasks: state.careTasks.map((t) =>
          t.id === action.taskId
            ? { ...t, done: true, result: action.result ?? t.result }
            : t),
      };

    case "claimMealSlot":
      return {
        ...state,
        mealSlots: state.mealSlots.map((s) =>
          s.id === action.slotId
            ? {
                ...s,
                claimedByName: shortName(state.currentUser.name),
                title: action.title ?? s.title,
              }
            : s),
      };

    // -- Archive ------------------------------------------------------------

    /**
     * Naming a face is the payoff of the whole "race against time" feature: the
     * guess is cleared at the same moment, because a confirmed name supersedes it.
     */
    case "nameFace":
      return {
        ...state,
        archivePhotos: state.archivePhotos.map((p) =>
          p.id === action.photoId
            ? {
                ...p,
                faces: p.faces.map((f) =>
                  f.id === action.faceId
                    ? { ...f, name: action.name, guess: undefined }
                    : f),
              }
            : p),
      };

    case "addPhotoClue":
      return {
        ...state,
        archivePhotos: state.archivePhotos.map((p) =>
          p.id === action.photoId
            ? {
                ...p,
                clues: [
                  { authorName: state.currentUser.name, body: action.body, whenText: "Just now" },
                  ...p.clues,
                ],
              }
            : p),
      };

    case "toggleSaveRecipe":
      return {
        ...state,
        recipes: state.recipes.map((r) =>
          r.id === action.recipeId
            ? { ...r, savedByCurrentUser: !r.savedByCurrentUser }
            : r),
      };

    // -- Coordination -------------------------------------------------------

    case "toggleRsvp": {
      const pid = state.currentUser.personId;
      return {
        ...state,
        events: state.events.map((e) => {
          if (e.id !== action.eventId) return e;
          const yes = e.rsvpYes ?? [];
          return {
            ...e,
            rsvpYes: yes.includes(pid) ? yes.filter((x) => x !== pid) : [...yes, pid],
          };
        }),
      };
    }

    case "claimPotluck":
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.eventId
            ? {
                ...e,
                potluck: e.potluck?.map((i) =>
                  i.id === action.itemId
                    ? { ...i, claimedByName: shortName(state.currentUser.name) }
                    : i),
              }
            : e),
      };

    case "sendNudge":
      return state.sentNudges.includes(action.personId)
        ? state
        : { ...state, sentNudges: [...state.sentNudges, action.personId] };

    /**
     * Bereavement mode. Freezing the profile is only half the job -- the reason
     * this action exists is the other half: every automated prompt about this
     * person stops immediately. An automated birthday reminder for someone who
     * died last month is the wound that makes a family delete the app.
     */
    case "memorialise":
      return {
        ...state,
        people: state.people.map((p) =>
          p.id === action.personId
            ? { ...p, memorialised: true, isLiving: false }
            : p),
        events: state.events.filter(
          (e) => !(e.auto && e.personIds.includes(action.personId))),
      };
  }
}

/**
 * Initial state: EVERYTHING empty.
 *
 * Not a single slice is seeded. A new family's circle is genuinely empty until they put
 * something in it, and the UI's job is to say so warmly and show them the first step --
 * not to disguise the emptiness with a stranger's family. `status: 'loading'` covers
 * the gap before the first fetch returns, so screens never render an empty state that
 * is really just a request in flight.
 */
const initialState: State = {
  family: { id: "", name: "", plan: "free" },
  currentUser: { id: "", name: "", role: "member", personId: "" },
  people: [],
  deeds: [],
  comments: [],
  status: "loading",
  threads: [],
  messages: [],
  careCircles: [],
  careTasks: [],
  doctorNotes: [],
  medications: [],
  mealSlots: [],
  emergencyCards: [],
  recipes: [],
  archivePhotos: [],
  events: [],
  sentNudges: [],
};

interface Store extends State {
  dispatch: React.Dispatch<Action>;

  /**
   * Re-fetch the server-backed slices.
   *
   * Also the error-recovery path: every optimistic mutation calls this when its API
   * request fails, so the UI converges on what the database actually contains rather
   * than silently keeping a local edit that was never saved.
   */
  refresh: () => Promise<void>;

  /** Server-backed writes. Optimistic locally, then persisted. */
  actions: {
    addDeed: (input: {
      /** Register. Defaults to "memory" server-side if omitted. */
      kind?: MemoryKind;
      title: string; whenText: string; whenDate?: string; story?: string;
      personIds?: string[]; tags?: string[]; mediaIds?: string[];
      audience?: Audience; fromMessageId?: string;
      /** Override the kind's default resurfacing rule. */
      mayResurface?: boolean;
    }) => Promise<string | undefined>;
    toggleReaction: (deedId: string, kind: ReactionKind) => Promise<void>;
    addComment: (deedId: string, body: string, parentId?: string) => Promise<void>;
    flagDeed: (deedId: string) => Promise<void>;
    addPerson: (input: {
      name: string; birthDate?: string; deathDate?: string; bio?: string;
      location?: string; isLiving?: boolean; parentIds?: string[]; spouseIds?: string[];
    }) => Promise<string | undefined>;
    addRecipe: (input: {
      title: string; attribution: string; personId?: string; provenance?: string;
      origin?: string; originYear?: string; prepText?: string; yieldText?: string;
      ingredients?: string[]; steps?: string[]; tradition?: string;
      photoMediaId?: string; cardMediaId?: string;
    }) => Promise<string | undefined>;
    memorialise: (personId: string) => Promise<void>;
    setFamilyName: (name: string) => Promise<void>;
    sendMessage: (threadId: string, input: { body?: string; mediaIds?: string[] }) => Promise<void>;
    createThread: (input?: { title?: string; kind?: string; audience?: string; memberIds?: string[] }) => Promise<string | undefined>;
    createCareCircle: (input: { personId: string; status?: string; memberIds?: string[] }) => Promise<string | undefined>;
    claimCareTask: (taskId: string) => Promise<void>;
    completeCareTask: (taskId: string, result?: string) => Promise<void>;
    claimMealSlot: (slotId: string, title?: string) => Promise<void>;
    toggleSaveRecipe: (recipeId: string) => Promise<void>;
    nameFace: (photoId: string, faceId: string, name: string) => Promise<void>;
    addPhotoClue: (photoId: string, body: string) => Promise<void>;
    toggleRsvp: (eventId: string) => Promise<void>;
    claimPotluck: (eventId: string, itemId: string) => Promise<void>;
    sendNudge: (personId: string, action?: string) => Promise<void>;
    uploadMedia: (uri: string, contentType: string, durationSec?: number) => Promise<{ id: string; uri: string } | undefined>;
  };

  personById: (id: string) => Person | undefined;
  deedsForPerson: (personId: string) => Deed[];
  commentsForDeed: (deedId: string) => Comment[];

  /** Audience-aware. This is the only gate; screens must not roll their own. */
  visible: (audience: Audience) => boolean;
  visibleThreads: () => Thread[];
  messagesForThread: (threadId: string) => Message[];

  tasksForToday: (circleId: string) => CareTask[];
  careProgress: (circleId: string) => { done: number; total: number };
  emergencyCardFor: (personId: string) => EmergencyCard | undefined;

  recipeById: (id: string) => Recipe | undefined;
  unnamedFaceCount: () => number;

  /**
   * Upcoming birthdays and anniversaries, derived from the tree rather than
   * typed in. Memorialised people are excluded -- see `memorialise`.
   */
  upcomingEvents: (withinDays?: number) => { event: FamilyEvent; daysAway: number }[];
  onThisDay: () => Deed[];
}

const StoreContext = createContext<Store | null>(null);

/** Whole days from today to `iso`, ignoring the year for recurring dates. */
function daysUntil(iso: string, recurring: boolean): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return Number.POSITIVE_INFINITY;

  let next = recurring
    ? new Date(today.getFullYear(), target.getMonth(), target.getDate())
    : new Date(target.getFullYear(), target.getMonth(), target.getDate());

  if (recurring && next < today) next = new Date(today.getFullYear() + 1, target.getMonth(), target.getDate());

  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  /**
   * Load everything the server owns.
   *
   * One Promise.all rather than sequential awaits: these are independent reads and a
   * cold start on a phone is the moment the app feels slow or fast.
   */
  const refresh = useCallback(async () => {
    try {
      const session = await api.me();
      if (!session) {
        // No valid token. App.tsx shows the sign-in screen; this is not an error.
        dispatch({ type: "loadFailed", message: "" });
        return;
      }

      /**
       * Load every slice in parallel.
       *
       * Messages are fetched per thread, so they come in a second wave once the thread
       * list is known -- a cold start on a phone is the moment the app feels fast or
       * slow, and serialising these would be the single biggest thing making it slow.
       */
      const [people, deeds, threads, care, recipes, archivePhotos, events] = await Promise.all([
        api.people(), api.deeds(), api.threads(), api.care(),
        api.recipes(), api.archivePhotos(), api.events(),
      ]);

      const messages = (
        await Promise.all(threads.map((t) => api.messages(t.id)))
      ).flat();

      dispatch({
        type: "hydrate",
        data: {
          family: session.family, currentUser: session.user, people, deeds, threads, messages,
          careCircles: care.circles,
          careTasks: care.tasks,
          medications: care.medications,
          mealSlots: care.mealSlots,
          doctorNotes: care.doctorNotes,
          emergencyCards: care.emergencyCards,
          recipes, archivePhotos, events,
        },
      });
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : `could not load your family: ${(err as Error).message}`;
      dispatch({ type: "loadFailed", message });
    }
  }, []);

  // Hydrate on mount, and whenever a sign-in stores a new token (App.tsx remounts
  // the provider's consumers by changing phase, and refresh() is idempotent).
  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<Store>(() => {
    const visible = (audience: Audience) => canView(state.currentUser, audience);

    /**
     * Every write follows the same shape: dispatch locally for instant feedback, call
     * the API, and refresh on failure so the client cannot keep an edit the database
     * rejected. `refresh` is the reconciliation mechanism -- simpler and more honest
     * than trying to compute an inverse for each action.
     */
    const persist = async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await work();
      } catch (err) {
        console.warn("[store] write failed, reloading from server:", (err as Error).message);
        await refresh();
        return undefined;
      }
    };

    return {
      ...state,
      dispatch,
      refresh,

      actions: {
        addDeed: (input) => persist(async () => {
          const id = await api.addDeed(input);
          // Refetch rather than synthesising the row: the server assigns createdAt and
          // the author byline, and guessing them would make the card change under the
          // user a second later.
          await refresh();
          return id;
        }),

        toggleReaction: async (deedId, kind) => {
          // Optimistic: a reaction that lags feels broken, and this is the product's
          // primary affection gesture.
          dispatch({ type: "toggleReaction", deedId, kind });
          await persist(() => api.toggleReaction(deedId, kind));
        },

        addComment: async (deedId, body, parentId) => {
          await persist(async () => {
            await api.addComment(deedId, body, parentId);
            await refresh();
          });
        },

        flagDeed: async (deedId) => {
          dispatch({ type: "flagDeed", deedId });
          await persist(() => api.flagDeed(deedId));
        },

        addPerson: (input) => persist(async () => {
          const id = await api.addPerson(input);
          // Refetch: the server resolves relationship edges in both directions, and the
          // tree layout depends on them being right.
          await refresh();
          return id;
        }),

        addRecipe: (input) => persist(async () => {
          const id = await api.addRecipe(input);
          await refresh();
          return id;
        }),

        memorialise: async (personId) => {
          // Local first: bereavement mode must silence prompts instantly, before any
          // round trip. A birthday nudge appearing during the request is the exact
          // wound this feature exists to prevent.
          dispatch({ type: "memorialise", personId });
          await persist(async () => {
            await api.memorialise(personId);
            await refresh();
          });
        },

        setFamilyName: async (name) => {
          dispatch({ type: "setFamilyName", name });
          await persist(() => api.renameFamily(name));
        },

        sendMessage: async (threadId, input) => {
          await persist(async () => {
            await api.sendMessage(threadId, input);
            // Refetch rather than synthesising: the server sets createdAt and the byline.
            await refresh();
          });
        },

        createThread: (input = {}) => persist(async () => {
          const id = await api.createThread(input);
          await refresh();
          return id;
        }),

        createCareCircle: (input) => persist(async () => {
          const id = await api.createCareCircle(input);
          await refresh();
          return id;
        }),

        claimCareTask: async (taskId) => {
          // Optimistic: claiming is the gesture that resolves "who is doing this?", and
          // a lag there re-introduces exactly the doubt the feature removes.
          dispatch({ type: "claimCareTask", taskId });
          await persist(() => api.claimCareTask(taskId));
        },

        completeCareTask: async (taskId, result) => {
          dispatch({ type: "completeCareTask", taskId, result });
          await persist(() => api.completeCareTask(taskId, result));
        },

        claimMealSlot: async (slotId, title) => {
          dispatch({ type: "claimMealSlot", slotId, title });
          await persist(() => api.claimMealSlot(slotId, title));
        },

        toggleSaveRecipe: async (recipeId) => {
          dispatch({ type: "toggleSaveRecipe", recipeId });
          await persist(() => api.toggleSaveRecipe(recipeId));
        },

        nameFace: async (photoId, faceId, name) => {
          dispatch({ type: "nameFace", photoId, faceId, name });
          await persist(() => api.nameFace(faceId, name));
        },

        addPhotoClue: async (photoId, body) => {
          await persist(async () => {
            await api.addPhotoClue(photoId, body);
            await refresh();
          });
        },

        toggleRsvp: async (eventId) => {
          dispatch({ type: "toggleRsvp", eventId });
          await persist(() => api.toggleRsvp(eventId));
        },

        claimPotluck: async (eventId, itemId) => {
          dispatch({ type: "claimPotluck", eventId, itemId });
          await persist(() => api.claimPotluck(eventId, itemId));
        },

        sendNudge: async (personId, action) => {
          dispatch({ type: "sendNudge", personId });
          await persist(() => api.sendNudge(personId, action));
        },

        uploadMedia: (uri, contentType, durationSec) =>
          persist(() => api.uploadMedia(uri, contentType, durationSec)),
      },

      personById: (id) => state.people.find((p) => p.id === id),
      deedsForPerson: (personId) =>
        state.deeds.filter((d) => d.personIds.includes(personId) && visible(d.audience)),
      commentsForDeed: (deedId) =>
        state.comments
          .filter((c) => c.deedId === deedId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),

      visible,
      visibleThreads: () =>
        state.threads.filter(
          (t) => visible(t.audience) && t.memberIds.includes(state.currentUser.personId)),
      messagesForThread: (threadId) =>
        state.messages
          .filter((m) => m.threadId === threadId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),

      tasksForToday: (circleId) =>
        state.careTasks.filter((t) => t.circleId === circleId),
      careProgress: (circleId) => {
        const all = state.careTasks.filter((t) => t.circleId === circleId);
        return { done: all.filter((t) => t.done).length, total: all.length };
      },
      emergencyCardFor: (personId) =>
        state.emergencyCards.find((c) => c.personId === personId),

      recipeById: (id) => state.recipes.find((r) => r.id === id),
      unnamedFaceCount: () =>
        state.archivePhotos.reduce(
          (n, p) => n + p.faces.filter((f) => !f.name).length, 0),

      upcomingEvents: (withinDays = 45) => {
        const memorialised = new Set(
          state.people.filter((p) => p.memorialised).map((p) => p.id));

        const fromTree: FamilyEvent[] = state.people
          .filter((p) => p.isLiving && !p.memorialised && p.birthDate)
          .map((p) => ({
            id: "auto_bd_" + p.id,
            kind: "birthday" as const,
            title: p.name + "'s birthday",
            date: p.birthDate as string,
            auto: true,
            personIds: [p.id],
          }));

        const explicit = state.events.filter(
          (e) => !e.personIds.some((id) => memorialised.has(id)));

        // An auto birthday and a hand-written one for the same person would
        // otherwise both show; the explicit entry is the richer of the two.
        const explicitBirthdayPeople = new Set(
          explicit.filter((e) => e.kind === "birthday").flatMap((e) => e.personIds));

        return [...explicit, ...fromTree.filter(
            (e) => !e.personIds.some((id) => explicitBirthdayPeople.has(id)))]
          .map((event) => ({
            event,
            daysAway: daysUntil(
              event.date, event.kind === "birthday" || event.kind === "anniversary"),
          }))
          .filter((x) => x.daysAway >= 0 && x.daysAway <= withinDays)
          .sort((a, b) => a.daysAway - b.daysAway);
      },

      /**
       * "On This Day" -- the cheapest engagement engine there is, and one that fits this
       * product honestly because the content is genuinely theirs.
       *
       * IT MUST NOT RESURFACE GRIEF UNPROMPTED. A bereavement or a serious illness
       * arriving unannounced on its anniversary is the same class of wound as the
       * automated birthday reminder for someone who has died -- which ideas.md calls
       * unforgivable, and which is the kind of thing that makes a family delete an app
       * and tell everyone why.
       *
       * `mayResurface` defaults from the entry's kind server-side (false for hardTime and
       * inMemory) but is stored per row, so a family can choose to let one particular hard
       * time come round again. Their call, not ours.
       */
      onThisDay: () => {
        const now = new Date();
        return state.deeds.filter((d) => {
          if (!d.whenDate || !visible(d.audience)) return false;
          // Absent means allowed: only an explicit false opts out.
          if (d.mayResurface === false) return false;
          const when = new Date(d.whenDate);
          if (Number.isNaN(when.getTime())) return false;
          return when.getMonth() === now.getMonth() && when.getFullYear() !== now.getFullYear();
        });
      },
    };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/**
 * Re-hydrate after a sign-in or sign-out.
 *
 * The token lives in src/api.ts, so the store has no way to observe a login. App.tsx
 * calls this when the auth phase changes.
 */
export function useRefreshStore(): () => Promise<void> {
  return useStore().refresh;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside a StoreProvider");
  return ctx;
}

/** Stable-enough ids for local-only V1 data. */
export function newId(prefix: string): string {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
