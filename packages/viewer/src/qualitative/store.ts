// Copyright (c) 2025 Apple Inc. Licensed under MIT License.

import { derived, get, writable, type Readable, type Writable } from "svelte/store";

import type { RowID } from "../charts/chart.js";

export type CodeLevel = 1 | 2 | 3;

export interface Code {
  id: string;
  name: string;
  description: string;
  color: string;
  parentId?: string;
  level: CodeLevel;
  createdAt: Date;
  createdBy?: string;
  frequency: number;
  antActorType?: "human" | "non-human" | "hybrid";
}

export interface Memo {
  id: string;
  content: string;
  linkedCodes: string[];
  linkedDataPoints: RowID[];
  memoType: "theoretical" | "methodological" | "observational";
  createdAt: Date;
  tags: string[];
}

export interface CodeRelation {
  id: string;
  fromCode: string;
  toCode: string;
  relationType: "is-a" | "part-of" | "causes" | "contradicts" | "associates-with";
  strength?: number;
  notes?: string;
}

export interface CodingEvent {
  timestamp: Date;
  action: "apply" | "remove" | "create" | "merge" | "split";
  codeId: string;
  dataPointIds: RowID[];
  coder?: string;
  notes?: string;
}

export interface Actor {
  id: string;
  name: string;
  actorType: "human" | "non-human" | "hybrid";
  role: "intermediary" | "mediator";
  description?: string;
}

export interface ActorLink {
  id: string;
  fromActor: string;
  toActor: string;
  translationType: string;
  dataPointIds: RowID[];
  notes?: string;
}

export interface TemporalCode {
  id: string;
  codeId: string;
  startTime: number;
  endTime: number;
  videoId: RowID;
}

function createId(prefix: string) {
  let id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${id}`;
}

function toColor(index: number) {
  const palette = [
    "#2563eb",
    "#16a34a",
    "#f97316",
    "#ef4444",
    "#8b5cf6",
    "#14b8a6",
    "#facc15",
    "#ec4899",
  ];
  return palette[index % palette.length];
}

export function createQualitativeStore(): {
  codes: Writable<Code[]>;
  memos: Writable<Memo[]>;
  relations: Writable<CodeRelation[]>;
  actors: Writable<Actor[]>;
  actorLinks: Writable<ActorLink[]>;
  temporalCodes: Writable<TemporalCode[]>;
  assignments: Writable<Record<string, RowID[]>>;
  codingEvents: Writable<CodingEvent[]>;
  codesWithFrequency: Readable<Code[]>;
  assignmentsByRow: Readable<Record<string, string[]>>;
  cooccurrence: Readable<Record<string, Record<string, number>>>;
  saturation: Readable<{ totalCodes: number; recentNewCodes: number; trend: string }>;
  createCode: (partial: Partial<Code>) => Code;
  applyCode: (codeId: string, rowIds: RowID[]) => void;
  removeCode: (codeId: string, rowIds: RowID[]) => void;
  createMemo: (memo: Omit<Memo, "id" | "createdAt">) => Memo;
  createRelation: (relation: Omit<CodeRelation, "id">) => CodeRelation;
  addActor: (actor: Omit<Actor, "id">) => Actor;
  addActorLink: (link: Omit<ActorLink, "id">) => ActorLink;
  exportRefiQda: () => string;
} {
  const codes = writable<Code[]>([]);
  const memos = writable<Memo[]>([]);
  const relations = writable<CodeRelation[]>([]);
  const actors = writable<Actor[]>([]);
  const actorLinks = writable<ActorLink[]>([]);
  const temporalCodes = writable<TemporalCode[]>([]);
  const assignments = writable<Record<string, RowID[]>>({});
  const codingEvents = writable<CodingEvent[]>([]);

  const assignmentsByRow = derived(assignments, ($assignments) => {
    let result: Record<string, string[]> = {};
    for (let [codeId, rows] of Object.entries($assignments)) {
      for (let rowId of rows) {
        const key = String(rowId);
        result[key] = result[key] ?? [];
        if (!result[key].includes(codeId)) {
          result[key].push(codeId);
        }
      }
    }
    return result;
  });

  const codesWithFrequency = derived([codes, assignments], ([$codes, $assignments]) => {
    return $codes.map((code) => ({
      ...code,
      frequency: ($assignments[code.id] ?? []).length,
    }));
  });

  const cooccurrence = derived(assignmentsByRow, ($assignmentsByRow) => {
    let matrix: Record<string, Record<string, number>> = {};
    for (let codesForRow of Object.values($assignmentsByRow)) {
      for (let i = 0; i < codesForRow.length; i++) {
        for (let j = i + 1; j < codesForRow.length; j++) {
          let a = codesForRow[i];
          let b = codesForRow[j];
          matrix[a] = matrix[a] ?? {};
          matrix[b] = matrix[b] ?? {};
          matrix[a][b] = (matrix[a][b] ?? 0) + 1;
          matrix[b][a] = (matrix[b][a] ?? 0) + 1;
        }
      }
    }
    return matrix;
  });

  const saturation = derived([codes, codingEvents], ([$codes, $events]) => {
    const totalCodes = $codes.length;
    const recentEvents = $events.slice(-50);
    const recentNewCodes = recentEvents.filter((e) => e.action === "create").length;
    const trend = recentNewCodes <= 2 ? "Approaching saturation" : "Exploring";
    return { totalCodes, recentNewCodes, trend };
  });

  function logEvent(event: Omit<CodingEvent, "timestamp">) {
    codingEvents.update((events) => [...events, { ...event, timestamp: new Date() }]);
  }

  function createCode(partial: Partial<Code>): Code {
    const code: Code = {
      id: createId("code"),
      name: partial.name ?? "New Code",
      description: partial.description ?? "",
      color: partial.color ?? toColor(get(codes).length),
      parentId: partial.parentId,
      level: partial.level ?? 1,
      createdAt: new Date(),
      createdBy: partial.createdBy,
      frequency: 0,
      antActorType: partial.antActorType,
    };
    codes.update((list) => [...list, code]);
    logEvent({ action: "create", codeId: code.id, dataPointIds: [] });
    return code;
  }

  function applyCode(codeId: string, rowIds: RowID[]) {
    if (rowIds.length === 0) {
      return;
    }
    assignments.update((current) => {
      let existing = new Set(current[codeId] ?? []);
      rowIds.forEach((id) => existing.add(id));
      return { ...current, [codeId]: Array.from(existing) };
    });
    logEvent({ action: "apply", codeId, dataPointIds: rowIds });
  }

  function removeCode(codeId: string, rowIds: RowID[]) {
    if (rowIds.length === 0) {
      return;
    }
    assignments.update((current) => {
      let existing = new Set(current[codeId] ?? []);
      rowIds.forEach((id) => existing.delete(id));
      return { ...current, [codeId]: Array.from(existing) };
    });
    logEvent({ action: "remove", codeId, dataPointIds: rowIds });
  }

  function createMemo(memo: Omit<Memo, "id" | "createdAt">): Memo {
    const newMemo: Memo = {
      ...memo,
      id: createId("memo"),
      createdAt: new Date(),
    };
    memos.update((list) => [newMemo, ...list]);
    return newMemo;
  }

  function createRelation(relation: Omit<CodeRelation, "id">): CodeRelation {
    const newRelation: CodeRelation = { ...relation, id: createId("relation") };
    relations.update((list) => [...list, newRelation]);
    return newRelation;
  }

  function addActor(actor: Omit<Actor, "id">): Actor {
    const newActor: Actor = { ...actor, id: createId("actor") };
    actors.update((list) => [...list, newActor]);
    return newActor;
  }

  function addActorLink(link: Omit<ActorLink, "id">): ActorLink {
    const newLink: ActorLink = { ...link, id: createId("actor-link") };
    actorLinks.update((list) => [...list, newLink]);
    return newLink;
  }

  function exportRefiQda(): string {
    const $codes = get(codes);
    const $memos = get(memos);
    const $assignments = get(assignments);
    const codeXml = $codes
      .map(
        (code) =>
          `<Code id="${code.id}" name="${code.name}" color="${code.color}" level="${code.level}" parentId="${code.parentId ?? ""}"></Code>`,
      )
      .join("");
    const memoXml = $memos
      .map(
        (memo) =>
          `<Memo id="${memo.id}" type="${memo.memoType}" createdAt="${memo.createdAt.toISOString()}"><Content>${memo.content}</Content></Memo>`,
      )
      .join("");
    const codingXml = Object.entries($assignments)
      .flatMap(([codeId, rows]) =>
        rows.map((rowId) => `<Coding codeId="${codeId}" dataPointId="${String(rowId)}"></Coding>`),
      )
      .join("");
    return `<?xml version="1.0" encoding="UTF-8"?><Project>${codeXml}${memoXml}${codingXml}</Project>`;
  }

  return {
    codes,
    memos,
    relations,
    actors,
    actorLinks,
    temporalCodes,
    assignments,
    codingEvents,
    codesWithFrequency,
    assignmentsByRow,
    cooccurrence,
    saturation,
    createCode,
    applyCode,
    removeCode,
    createMemo,
    createRelation,
    addActor,
    addActorLink,
    exportRefiQda,
  };
}
