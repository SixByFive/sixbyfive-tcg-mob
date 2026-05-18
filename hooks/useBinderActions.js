// hooks/useBinderActions.js
import { useApolloClient, useMutation } from "@apollo/client";
import {
  AddCardToBinderDocument,
  BinderDocument,
  BrowseBindersDocument,
  CreateBinderDocument,
  DeleteBinderDocument,
  MyBindersDocument,
  MyCollectionDocument,
  SaveBinderPagesAndSlotsDocument,
  UpdateBinderDocument,
} from "../graphql/documents";
// MoveBinderSlot / RemoveBinderSlot do not exist in the tcg-runtime gateway schema.
// Both operations are implemented below using saveBinderPagesAndSlots (full bulk-save).
import { useCallback } from "react";
import useToast from "./useToast";

let SAFE_DOCS = {};
try {
  SAFE_DOCS = require("../graphql/binders-temp");
} catch (err) {
  if (__DEV__) console.warn("[useBinderActions] Safe binder queries unavailable", err?.message ?? err);
}

const BINDER_QUERY = SAFE_DOCS.BINDER_SAFE || BinderDocument;
const MY_BINDERS_QUERY = SAFE_DOCS.MY_BINDERS_SAFE || MyBindersDocument;

/* ----------------------------- debug helpers ----------------------------- */

const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log(...args);
}
function logError(tag, err, extra = {}) {
  if (!DEBUG) return;
  console.warn(`[${tag}] ERROR:`, err?.message || err);

  const ge = err?.graphQLErrors || [];
  const ne = err?.networkError;
  if (ge.length) {
    console.warn(`[${tag}] graphQLErrors:`);
    ge.forEach((e, i) =>
      console.warn(
        `  #${i + 1}:`,
        e.message,
        e.path ? ` path=${JSON.stringify(e.path)}` : "",
        e.extensions ? ` extensions=${JSON.stringify(e.extensions)}` : ""
      )
    );
  }
  if (ne) {
    console.warn(`[${tag}] networkError:`, ne.message || ne);
    const bodyErrs = ne?.result?.errors;
    if (Array.isArray(bodyErrs) && bodyErrs.length) {
      console.warn(`[${tag}] networkError.result.errors:`);
      bodyErrs.forEach((e, i) =>
        console.warn(
          `  #${i + 1}:`,
          e.message,
          e.path ? ` path=${JSON.stringify(e.path)}` : "",
          e.extensions ? ` extensions=${JSON.stringify(e.extensions)}` : ""
        )
      );
    }
  }
  if (extra && Object.keys(extra).length) {
    console.warn(`[${tag}] extra:`, JSON.stringify(extra, null, 2));
  }
}

/* -------------------------------- utils -------------------------------- */

const sid = (v) => (v == null ? "" : String(v));
const isFiniteNum = (n) => Number.isFinite(n);

// Backend layouts + capacity
const CAPACITY = { "pocket-9": 9, "pocket-4": 4, "pocket-3": 3, full: 1 };
const LAYOUT_BY_RC = { "3x3": "pocket-9", "2x2": "pocket-4", "3x1": "pocket-3", "1x1": "full" };

function layoutFromRowsCols(rows, cols) {
  const key = `${Number(rows) || 0}x${Number(cols) || 0}`;
  return LAYOUT_BY_RC[key] || "pocket-9";
}

/** Extract a usable card id (actual `cards.id` = code like "sv05-052") from a slot shape */
function slotCardId(s) {
  // accept a wide range of shapes; NEVER assume a `card` object exists
  const c =
    s?.cardId ??
    s?.cardCode ??
    s?.card_id ??
    s?.card?.code ??
    s?.card?.id ??
    (typeof s?.id === "string" && (s.id.match(/-/g) || []).length === 1 ? s.id : null);

  return c ? String(c) : null;
}

/** Unique + in-range positions; drop overflow if needed */
function normalizePositions(slots, capacity) {
  const taken = new Set();
  const cleaned = [];

  for (const s of slots) {
    if (!s || !s.cardId) continue;
    let pos = Number(s.position);
    if (!Number.isFinite(pos)) continue;
    pos = Math.max(1, Math.min(capacity, pos));
    cleaned.push({ ...s, position: pos });
  }

  for (let i = 0; i < cleaned.length; i++) {
    let pos = cleaned[i].position;
    while (taken.has(pos)) pos = pos + 1;
    if (pos > capacity) {
      cleaned[i] = null; // better than violating a unique constraint
    } else {
      cleaned[i].position = pos;
      taken.add(pos);
    }
  }
  return cleaned.filter(Boolean);
}

function summarizePagesPayload(pages) {
  return pages.map((p) => {
    const capacity = CAPACITY[p.layout] ?? 9;
    const positions = (Array.isArray(p.slots) ? p.slots : []).map((s) => s.position);
    const dupePositions = positions.filter((pos, idx) => positions.indexOf(pos) !== idx);
    const outOfRange = positions.filter((pos) => pos < 1 || pos > capacity);
    return {
      pageId: p.id || "(new)",
      title: p.title,
      layout: p.layout,
      pageOrder: p.pageOrder,
      slots: p.slots?.length || 0,
      dupePositions,
      outOfRange,
      min: positions.length ? Math.min(...positions) : null,
      max: positions.length ? Math.max(...positions) : null,
      capacity,
    };
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^[a-z]{2,4}\d{1,4}-[0-9a-z]{2,6}$/i;

function coerceCardCodeFromCache(apollo, v) {
  const s = String(v || "");
  if (CODE_RE.test(s)) return s; // already like "sv05-052"
  if (!UUID_RE.test(s)) return s; // not a UUID → pass through
  try {
    const data = apollo.readQuery({ query: MyCollectionDocument });
    const arr =
      (data?.myCollection?.edges?.map((e) => e?.node).filter(Boolean)) ||
      data?.myCollection ||
      data?.collection ||
      [];
    for (const row of arr) {
      if (String(row?.id) === s) {
        const code =
          row?.card?.code ||
          row?.card?.id || // some schemas store code in id
          row?.code ||
          row?.cardCode ||
          row?.cardId;
        if (code && CODE_RE.test(String(code))) return String(code);
      }
    }
  } catch {
    // cache miss is fine
  }
  return s;
}

/**
 * Build a COMPLETE pages payload from cached binder + optional patch.
 * - Preserves original pageOrder if present.
 * - Positions are 1-based (server-safe).
 * - Patch may specify pageIndex or pageId; pageId wins when both provided.
 */
function buildPagesPayload(binder, patch) {
  const pages = Array.isArray(binder?.pages) ? binder.pages : [];

  return pages
    .slice() // copy
    .sort((a, b) => {
      const ao = Number.isFinite(a?.pageOrder) ? Number(a.pageOrder) : 0;
      const bo = Number.isFinite(b?.pageOrder) ? Number(b.pageOrder) : 0;
      return ao - bo;
    })
    .map((p, idx) => {
      const slotsArr = Array.isArray(p?.slots) ? p.slots : [];
      const layout = p?.layout || "pocket-9";
      const capacity = CAPACITY[layout] ?? 9;

      const slots = [];

      // existing occupied slots
      for (let i = 0; i < slotsArr.length; i++) {
        const s = slotsArr[i];
        if (!s) continue;
        const code = slotCardId(s);
        if (!code) continue;

        const pos =
          Number.isFinite(s?.position) && Number(s.position) > 0 ? Number(s.position) : i + 1;

        slots.push({
          ...(s?.id ? { id: sid(s.id) } : {}),
          cardId: sid(code),
          position: pos, // 1-based for server
          quantity: isFiniteNum(s?.quantity) ? Number(s.quantity) : 1,
          ...(s?.notes ? { notes: s.notes } : {}),
        });
      }

      // Optional patch → add one card into the correct page
      const matchesPatchById = patch?.pageId && sid(patch.pageId) === sid(p.id);
      const matchesPatchByIndex =
        !patch?.pageId &&
        Number(patch?.pageIndex) === (Number.isFinite(p?.pageOrder) ? Number(p.pageOrder) : idx);

      if (patch && (matchesPatchById || matchesPatchByIndex)) {
        slots.push({
          cardId: sid(patch.cardId),
          position: Number(patch.slotIndex || 0) + 1, // UI 0-based → 1-based
          quantity: isFiniteNum(patch.quantity) ? Number(patch.quantity) : 1,
          ...(patch?.notes ? { notes: patch.notes } : {}),
        });
      }

      const saneSlots = normalizePositions(slots, capacity);

      return {
        id: sid(p.id),
        title:
          p?.title ?? `Page ${(Number.isFinite(p?.pageOrder) ? Number(p.pageOrder) : idx) + 1}`,
        layout,
        pageOrder: Number.isFinite(p?.pageOrder) ? Number(p.pageOrder) : idx,
        slots: saneSlots,
      };
    });
}

function buildPagesPayloadWithNewLayout(binder, newLayoutKey) {
  const pages = Array.isArray(binder?.pages) ? binder.pages : [];
  return pages
    .slice()
    .sort((a, b) => {
      const ao = Number.isFinite(a?.pageOrder) ? Number(a.pageOrder) : 0;
      const bo = Number.isFinite(b?.pageOrder) ? Number(b.pageOrder) : 0;
      return ao - bo;
    })
    .map((p, idx) => {
      const slotsArr = Array.isArray(p?.slots) ? p.slots : [];
      const capacity = CAPACITY[newLayoutKey] ?? 9;

      const saneSlots = normalizePositions(
        slotsArr
          .filter(Boolean)
          .map((s, i) => ({
            ...(s?.id ? { id: sid(s.id) } : {}),
            cardId: sid(slotCardId(s) || ""),
            position:
              Number.isFinite(s?.position) && Number(s.position) > 0 ? Number(s.position) : i + 1,
            quantity: isFiniteNum(s?.quantity) ? Number(s.quantity) : 1,
            ...(s?.notes ? { notes: s.notes } : {}),
          })),
        capacity
      );

      return {
        id: sid(p.id),
        title:
          p?.title ?? `Page ${(Number.isFinite(p?.pageOrder) ? Number(p.pageOrder) : idx) + 1}`,
        layout: newLayoutKey,
        pageOrder: Number.isFinite(p?.pageOrder) ? Number(p.pageOrder) : idx,
        slots: saneSlots,
      };
    });
}

/* ------------------------------ hook ------------------------------ */

export default function useBinderActions() {
  const apollo = useApolloClient();

  const [createBinderMut] = useMutation(CreateBinderDocument);
  const [updateBinderMut] = useMutation(UpdateBinderDocument);
  const [deleteBinderMut] = useMutation(DeleteBinderDocument);
  const [savePagesMut] = useMutation(SaveBinderPagesAndSlotsDocument);
  const [addCardMut] = useMutation(AddCardToBinderDocument);

  /** keep browse/my lists fresh after meta changes */
  function upsertBinderListCache(binder) {
    try {
      const mine = apollo.readQuery({ query: MY_BINDERS_QUERY });
      const list = mine?.myBinders;
      if (Array.isArray(list)) {
        const exists = list.some((b) => sid(b.id) === sid(binder.id));
        const myBinders = exists
          ? list.map((b) => (sid(b.id) === sid(binder.id) ? { ...b, ...binder } : b))
          : [binder, ...list];
        apollo.writeQuery({ query: MY_BINDERS_QUERY, data: { myBinders } });
      }
    } catch {}
    try {
      const browse = apollo.readQuery({ query: BrowseBindersDocument });
      const root = browse?.browseBinders ?? browse?.binders ?? browse;
      if (Array.isArray(root)) {
        const exists = root.some((b) => sid(b.id) === sid(binder.id));
        const newList = exists
          ? root.map((b) => (sid(b.id) === sid(binder.id) ? { ...b, ...binder } : b))
          : [binder, ...root];
        if (browse?.browseBinders) {
          apollo.writeQuery({
            query: BrowseBindersDocument,
            data: { browseBinders: newList },
          });
        } else if (browse?.binders) {
          apollo.writeQuery({
            query: BrowseBindersDocument,
            data: { binders: newList },
          });
        } else {
          apollo.writeQuery({ query: BrowseBindersDocument, data: newList });
        }
      }
    } catch {}
  }

  /* -------------------------------- actions -------------------------------- */

  async function createBinder({ name, cover } = {}) {
    const vars = {
      input: {
        name: (name || "Binder").trim(),
        ...(cover?.color ? { coverColor: cover.color } : {}),
        ...(cover?.accent ? { accentColor: cover.accent } : {}),
      },
    };
    log("[Binder/create] vars:", vars);
    try {
      const { data } = await createBinderMut({ variables: vars });
      const created = data?.createBinder ?? data?.binder ?? null;
      if (created) upsertBinderListCache(created);
      return created;
    } catch (e) {
      logError("Binder/create", e, { vars });
      throw e;
    }
  }

  /**
   * Update binder meta (name/colors) and/or layout (rows/cols/template).
   * Meta first; if layout changes, bulk-save with the new layout across all pages.
   */
  async function updateBinder({ binderId, name, cover, rows, cols, templateId } = {}) {
    const id = sid(binderId);

    // 1) meta (try both server shapes)
    const varsA = {
      id,
      input: {
        ...(typeof name === "string" && name.trim() ? { name: name.trim() } : {}),
        ...(cover?.color ? { coverColor: cover.color } : {}),
        ...(cover?.accent ? { accentColor: cover.accent } : {}),
      },
    };
    let updated = null;
    try {
      log("[Binder/update] varsA:", varsA);
      const { data } = await updateBinderMut({ variables: varsA });
      updated = data?.updateBinder ?? data?.binder ?? null;
    } catch (eA) {
      const varsB = { input: { id, ...varsA.input } };
      try {
        log("[Binder/update] varsB:", varsB);
        const { data } = await updateBinderMut({ variables: varsB });
        updated = data?.updateBinder ?? data?.binder ?? null;
      } catch (eB) {
        logError("Binder/update", eB, { tried: ["A", "B"], varsA, varsB });
        throw eB;
      }
    }
    if (updated) upsertBinderListCache(updated);

    // 2) layout change → bulk save (preserve pageOrder)
    const wantsLayoutChange =
      (isFiniteNum(rows) && isFiniteNum(cols)) || (typeof templateId === "string" && templateId);

    if (wantsLayoutChange) {
      const desiredLayout =
        (typeof templateId === "string" && templateId) || layoutFromRowsCols(rows, cols);
      const cached = apollo.readQuery({ query: BINDER_QUERY, variables: { id } });
      const binder = cached?.binder;
      if (binder) {
        const pagesPayload = buildPagesPayloadWithNewLayout(binder, desiredLayout);
        log("[Binder/update->savePages] payload summary:", summarizePagesPayload(pagesPayload));
        await savePages(id, pagesPayload);
      }
    }
    return updated;
  }

  async function deleteBinder(binderId) {
    const id = sid(binderId);
    const vars = { id };
    log("[Binder/delete] vars:", vars);
    try {
      await deleteBinderMut({ variables: vars });
      // prune lists
      try {
        const mine = apollo.readQuery({ query: MY_BINDERS_QUERY });
        if (mine?.myBinders) {
          apollo.writeQuery({
            query: MY_BINDERS_QUERY,
            data: { myBinders: mine.myBinders.filter((b) => sid(b.id) !== id) },
          });
        }
      } catch {}
      try {
        const browse = apollo.readQuery({ query: BrowseBindersDocument });
        const root = browse?.browseBinders ?? browse?.binders ?? browse;
        if (Array.isArray(root)) {
          const next = root.filter((b) => sid(b.id) !== id);
          if (browse?.browseBinders) {
            apollo.writeQuery({
              query: BrowseBindersDocument,
              data: { browseBinders: next },
            });
          } else if (browse?.binders) {
            apollo.writeQuery({
              query: BrowseBindersDocument,
              data: { binders: next },
            });
          } else {
            apollo.writeQuery({ query: BrowseBindersDocument, data: next });
          }
        }
      } catch {}
      return true;
    } catch (e) {
      logError("Binder/delete", e, { vars });
      throw e;
    }
  }

  /**
   * Add a page by bulk-saving the full pages array (keeps pageOrder continuous).
   */
  async function addPage(binderId) {
    const id = sid(binderId);
    const cached = apollo.readQuery({ query: BINDER_QUERY, variables: { id } });
    const binder = cached?.binder;
    const pages = Array.isArray(binder?.pages) ? binder.pages : [];
    const layout = pages[0]?.layout || "pocket-9";

    const lastOrder =
      pages
        .map((p) => (Number.isFinite(p?.pageOrder) ? Number(p.pageOrder) : 0))
        .reduce((a, b) => Math.max(a, b), -1) || -1;

    const nextPage = { title: `Page ${lastOrder + 2}`, layout, pageOrder: lastOrder + 1, slots: [] };
    const basePayload = buildPagesPayload(binder);
    const payload = [...basePayload, nextPage];

    log("[Binder/addPage] payload summary:", summarizePagesPayload(payload));
    try {
      const { data } = await savePagesMut({
        variables: { binderId: id, pages: payload },
        refetchQueries: [{ query: BINDER_QUERY, variables: { id } }],
      });
      return data?.saveBinderPagesAndSlots ?? data?.binder ?? null;
    } catch (e) {
      logError("Binder/addPage", e, { id, payloadSummary: summarizePagesPayload(payload) });
      throw e;
    }
  }

  /**
   * Remove a page (unless it's the only one) by bulk-saving the rest.
   */
  async function removePage(binderId, pageIndexOrId) {
    const id = sid(binderId);
    const cached = apollo.readQuery({ query: BINDER_QUERY, variables: { id } });
    const binder = cached?.binder;
    const pages = Array.isArray(binder?.pages) ? binder.pages : [];
    if (pages.length <= 1) {
      log("[Binder/removePage] blocked (only page)");
      return false;
    }

    const idx =
      typeof pageIndexOrId === "string"
        ? pages.findIndex((p) => sid(p.id) === sid(pageIndexOrId))
        : Number(pageIndexOrId) || 0;

    const kept = pages
      .filter((_, i) => i !== idx)
      .sort((a, b) => {
        const ao = Number.isFinite(a?.pageOrder) ? Number(a.pageOrder) : 0;
        const bo = Number.isFinite(b?.pageOrder) ? Number(b.pageOrder) : 0;
        return ao - bo;
      });

    const payload = kept.map((p, i) => {
      const layout = p?.layout || "pocket-9";
      const capacity = CAPACITY[layout] ?? 9;
      const saneSlots = normalizePositions(
        (Array.isArray(p?.slots) ? p.slots : [])
          .filter(Boolean)
          .map((s, j) => ({
            ...(s?.id ? { id: sid(s.id) } : {}),
            cardId: sid(slotCardId(s) || ""),
            position:
              Number.isFinite(s?.position) && Number(s.position) > 0 ? Number(s.position) : j + 1,
            quantity: isFiniteNum(s?.quantity) ? Number(s.quantity) : 1,
            ...(s?.notes ? { notes: s.notes } : {}),
          })),
        capacity
      );
      // Re-number pageOrder densely from 0
      return {
        id: sid(p.id),
        title: p?.title ?? `Page ${i + 1}`,
        layout,
        pageOrder: i,
        slots: saneSlots,
      };
    });

    log("[Binder/removePage] payload summary:", summarizePagesPayload(payload));
    try {
      await savePagesMut({
        variables: { binderId: id, pages: payload },
        refetchQueries: [{ query: BINDER_QUERY, variables: { id } }],
      });
      return true;
    } catch (e) {
      logError("Binder/removePage", e, {
        id,
        pageIndexOrId,
        payloadSummary: summarizePagesPayload(payload),
      });
      throw e;
    }
  }

  async function savePages(binderId, pages) {
    const id = sid(binderId);
    log("[Binder/savePages] payload summary:", summarizePagesPayload(pages));
    try {
      const { data } = await savePagesMut({
        variables: { binderId: id, pages },
        refetchQueries: [{ query: BINDER_QUERY, variables: { id } }],
      });
      return data?.saveBinderPagesAndSlots ?? data?.binder ?? null;
    } catch (e) {
      logError("Binder/savePages", e, { id, payloadSummary: summarizePagesPayload(pages) });
      throw e;
    }
  }

  /**
   * Add a card. Fast path: addCardToBinder. On "not in collection", fall back to
   * bulk save of the FULL pages array, preserving pageOrder and slot positions.
   *
   * Accepts either:
   *  - { pageId, position (0-based), cardId, ... }
   *  - { binderId, pageIndex, slotIndex, cardId, ... } // legacy
   */
  async function addCard({
    pageId,
    position,
    cardId,
    quantity,
    notes,
    // legacy:
    binderId,
    pageIndex,
    slotIndex,
  }) {
    const code = coerceCardCodeFromCache(apollo, sid(cardId));
    let pid = pageId ? sid(pageId) : null;
    let pos0 = isFiniteNum(position) ? Number(position) : undefined;
    const bId = binderId ? sid(binderId) : null;

    if (!pid) {
      if (!bId) throw new Error("addCard requires pageId or binderId");
      // Try cache first, fall back to network fetch on miss
      let binderData = apollo.readQuery({ query: BINDER_QUERY, variables: { id: bId } });
      if (!binderData?.binder?.pages?.length) {
        try {
          const res = await apollo.query({ query: BINDER_QUERY, variables: { id: bId }, fetchPolicy: "network-only" });
          binderData = res.data;
        } catch (fetchErr) {
          log("[Binder/addCard] binder fetch failed:", fetchErr?.message);
        }
      }
      let pages = Array.isArray(binderData?.binder?.pages) ? binderData.binder.pages : [];

      // Binder exists but has no pages yet — auto-create the first page
      if (!pages.length) {
        log("[Binder/addCard] no pages found, auto-creating first page");
        try {
          const defaultLayout = "pocket-9";
          const { data: createData } = await savePagesMut({
            variables: {
              binderId: bId,
              pages: [{ title: "Page 1", layout: defaultLayout, pageOrder: 0, slots: [] }],
            },
          });
          const newBinder =
            createData?.saveBinderPagesAndSlots ??
            createData?.binder ??
            null;
          pages = Array.isArray(newBinder?.pages) ? newBinder.pages : [];
        } catch (createErr) {
          log("[Binder/addCard] auto-create page failed:", createErr?.message);
        }
      }

      const p = pages[Number(pageIndex) || 0];
      if (!p?.id) throw new Error("Unable to resolve pageId from binder cache");
      pid = sid(p.id);
      pos0 =
        isFiniteNum(slotIndex) ? Number(slotIndex) : Array.isArray(p.slots) ? p.slots.length : 0;
    }
    const pos1 = Number(pos0) + 1;

    // Fast path
    const fastVars = {
      pageId: pid,
      input: {
        cardId: code,
        position: pos1,
        ...(isFiniteNum(quantity) ? { quantity: Number(quantity) } : {}),
        ...(notes ? { notes } : {}),
      },
    };
    log("[Binder/addCard fast] vars:", fastVars);
    try {
      const { data } = await addCardMut({
        variables: fastVars,
        refetchQueries: bId ? [{ query: BINDER_QUERY, variables: { id: bId } }] : undefined,
      });
      const added = data?.addCardToBinder ?? null;
      log("[Binder/addCard fast] ok:", !!added);
      return added;
    } catch (e) {
      logError("Binder/addCard fast", e, { vars: fastVars });

      // Fallback — build FULL pages payload, patch the specific page by pageId.
      // If binderId isn't provided, locate it by scanning cached binders for this pageId.
      const binderIdToUse =
        bId ||
        (() => {
          try {
            const mine = apollo.readQuery({ query: MY_BINDERS_QUERY })?.myBinders || [];
            for (const b of mine) {
              try {
                const cached = apollo.readQuery({
                  query: BINDER_QUERY,
                  variables: { id: sid(b.id) },
                });
                const pages = Array.isArray(cached?.binder?.pages) ? cached.binder.pages : [];
                if (pages.some((pg) => sid(pg?.id) === pid)) return sid(b.id);
              } catch {}
            }
          } catch {}
          return "";
        })();
      if (!binderIdToUse) throw e;

      const cachedBinder =
        apollo.readQuery({
          query: BINDER_QUERY,
          variables: { id: binderIdToUse },
        })?.binder || null;
      if (!cachedBinder) throw e;

      const patch = {
        pageId: pid, // target by pageId (more reliable than index)
        pageIndex, // kept for completeness; ignored when pageId present
        slotIndex: pos0 || 0, // UI 0-based
        cardId: code,
        quantity: isFiniteNum(quantity) ? Number(quantity) : 1,
        notes,
      };

      const pagesPayload = buildPagesPayload(cachedBinder, patch);

      log("[Binder/addCard fallback] binderId:", binderIdToUse);
      log("[Binder/addCard fallback] payload summary:", summarizePagesPayload(pagesPayload));

      try {
        const { data } = await savePagesMut({
          variables: { binderId: binderIdToUse, pages: pagesPayload },
          refetchQueries: [{ query: BINDER_QUERY, variables: { id: binderIdToUse } }],
        });
        const ok = data?.saveBinderPagesAndSlots ?? data?.binder ?? null;
        log("[Binder/addCard fallback] ok:", !!ok);
        return ok;
      } catch (e2) {
        logError("Binder/addCard fallback", e2, {
          binderId: binderIdToUse,
          payloadSummary: summarizePagesPayload(pagesPayload),
        });
        throw e2;
      }
    }
  }

  /**
   * Move a slot (within/between pages) via full pages bulk-save.
   * moveBinderSlot does not exist in the tcg-runtime schema; we reconstruct
   * the complete pages payload with the slot removed from the source page and
   * inserted at the destination page/position, then call saveBinderPagesAndSlots.
   */
  async function moveSlot({ binderId, fromPage, fromSlot, toPage, toSlot }) {
    const bId = sid(binderId);
    const cached = apollo.readQuery({ query: BINDER_QUERY, variables: { id: bId } });
    const pages = Array.isArray(cached?.binder?.pages) ? cached.binder.pages : [];

    const fromPgIdx   = Number(fromPage) || 0;
    const toPgIdx     = Number(toPage)   || 0;
    const fromSlotIdx = Number(fromSlot) || 0;

    const fromPg = pages[fromPgIdx];
    const toPg   = pages[toPgIdx];
    if (!fromPg || !toPg) throw new Error("Unable to resolve source or destination page");

    const slotToMove = Array.isArray(fromPg?.slots) ? fromPg.slots[fromSlotIdx] : null;
    if (!slotToMove) throw new Error("Unable to resolve source slot");

    const cardId = slotCardId(slotToMove);
    if (!cardId) throw new Error("Source slot has no cardId");

    const pagesPayload = pages
      .slice()
      .sort((a, b) => {
        const ao = Number.isFinite(a?.pageOrder) ? Number(a.pageOrder) : 0;
        const bo = Number.isFinite(b?.pageOrder) ? Number(b.pageOrder) : 0;
        return ao - bo;
      })
      .map((p, idx) => {
        const layout   = p?.layout || "pocket-9";
        const capacity = CAPACITY[layout] ?? 9;
        const isFrom   = idx === fromPgIdx;
        const isTo     = idx === toPgIdx;

        let slots = (Array.isArray(p?.slots) ? p.slots : [])
          .filter(Boolean)
          .filter((_, i) => !(isFrom && i === fromSlotIdx))
          .map((s, i) => ({
            ...(s?.id ? { id: sid(s.id) } : {}),
            cardId: sid(slotCardId(s) || ""),
            position: Number.isFinite(s?.position) && Number(s.position) > 0 ? Number(s.position) : i + 1,
            quantity: isFiniteNum(s?.quantity) ? Number(s.quantity) : 1,
            ...(s?.notes ? { notes: s.notes } : {}),
          }));

        if (isTo) {
          slots.push({
            cardId: sid(cardId),
            position: Number(toSlot) + 1,
            quantity: isFiniteNum(slotToMove?.quantity) ? Number(slotToMove.quantity) : 1,
            ...(slotToMove?.notes ? { notes: slotToMove.notes } : {}),
          });
        }

        return {
          id: sid(p.id),
          title: p?.title ?? `Page ${idx + 1}`,
          layout,
          pageOrder: Number.isFinite(p?.pageOrder) ? Number(p.pageOrder) : idx,
          slots: normalizePositions(slots, capacity),
        };
      });

    log("[Binder/moveSlot] payload summary:", summarizePagesPayload(pagesPayload));
    try {
      await savePagesMut({
        variables: { binderId: bId, pages: pagesPayload },
        refetchQueries: [{ query: BINDER_QUERY, variables: { id: bId } }],
      });
      return true;
    } catch (e) {
      logError("Binder/moveSlot", e, { binderId: bId, fromPage, fromSlot, toPage, toSlot });
      throw e;
    }
  }

  /**
   * Remove a slot via full pages bulk-save.
   * removeBinderSlot does not exist in the tcg-runtime schema; we reconstruct
   * the complete pages payload with the target slot omitted, then call saveBinderPagesAndSlots.
   */
  async function removeSlot({ binderId, pageIndex, slotIndex }) {
    const bId     = sid(binderId);
    const pgIdx   = Number(pageIndex) || 0;
    const slotIdx = Number(slotIndex) || 0;

    const cached = apollo.readQuery({ query: BINDER_QUERY, variables: { id: bId } });
    const pages  = Array.isArray(cached?.binder?.pages) ? cached.binder.pages : [];

    const pagesPayload = pages
      .slice()
      .sort((a, b) => {
        const ao = Number.isFinite(a?.pageOrder) ? Number(a.pageOrder) : 0;
        const bo = Number.isFinite(b?.pageOrder) ? Number(b.pageOrder) : 0;
        return ao - bo;
      })
      .map((p, idx) => {
        const layout   = p?.layout || "pocket-9";
        const capacity = CAPACITY[layout] ?? 9;
        const isTarget = idx === pgIdx;

        const slots = (Array.isArray(p?.slots) ? p.slots : [])
          .filter(Boolean)
          .filter((_, i) => !(isTarget && i === slotIdx))
          .map((s, i) => ({
            ...(s?.id ? { id: sid(s.id) } : {}),
            cardId: sid(slotCardId(s) || ""),
            position: Number.isFinite(s?.position) && Number(s.position) > 0 ? Number(s.position) : i + 1,
            quantity: isFiniteNum(s?.quantity) ? Number(s.quantity) : 1,
            ...(s?.notes ? { notes: s.notes } : {}),
          }));

        return {
          id: sid(p.id),
          title: p?.title ?? `Page ${idx + 1}`,
          layout,
          pageOrder: Number.isFinite(p?.pageOrder) ? Number(p.pageOrder) : idx,
          slots: normalizePositions(slots, capacity),
        };
      });

    log("[Binder/removeSlot] payload summary:", summarizePagesPayload(pagesPayload));
    try {
      await savePagesMut({
        variables: { binderId: bId, pages: pagesPayload },
        refetchQueries: [{ query: BINDER_QUERY, variables: { id: bId } }],
      });
      return true;
    } catch (e) {
      logError("Binder/removeSlot", e, { binderId: bId, pageIndex, slotIndex });
      throw e;
    }
  }

  return {
    createBinder,
    updateBinder,
    renameBinder: ({ binderId, name }) => updateBinder({ binderId, name }),
    deleteBinder,
    addPage,
    removePage,
    savePages,
    addCard,
    moveSlot,
    removeSlot,
  };
}




