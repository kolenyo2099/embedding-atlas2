<!-- Copyright (c) 2025 Apple Inc. Licensed under MIT License. -->
<script lang="ts">
  import type { Readable, Writable } from "svelte/store";

  import type { ChartContext } from "../charts/chart.js";
  import * as SQL from "@uwdata/mosaic-sql";
  import Button from "../widgets/Button.svelte";
  import Input from "../widgets/Input.svelte";
  import Select from "../widgets/Select.svelte";
  import { downloadBuffer } from "../utils/download.js";
  import type { Code, Memo } from "../qualitative/store.js";

  interface Props {
    context: ChartContext;
    selectedRows: Writable<any[] | null>;
    store: {
      codes: Writable<Code[]>;
      memos: Writable<Memo[]>;
      relations: Writable<any[]>;
      actors: Writable<any[]>;
      actorLinks: Writable<any[]>;
      codingEvents: Writable<any[]>;
      codesWithFrequency: Readable<Code[]>;
      assignmentsByRow: Writable<Record<string, string[]>>;
      cooccurrence: Readable<Record<string, Record<string, number>>>;
      saturation: Readable<{ totalCodes: number; recentNewCodes: number; trend: string }>;
      createCode: (partial: Partial<Code>) => Code;
      applyCode: (codeId: string, rowIds: any[]) => void;
      removeCode: (codeId: string, rowIds: any[]) => void;
      createMemo: (memo: Omit<Memo, "id" | "createdAt">) => Memo;
      createRelation: (relation: any) => void;
      addActor: (actor: any) => void;
      addActorLink: (link: any) => void;
      exportRefiQda: () => string;
    };
    onShowDetails: () => void;
    onRefreshColumns: () => Promise<void>;
  }

  let { context, selectedRows, store, onShowDetails, onRefreshColumns }: Props = $props();
  const { codes, memos, relations, actors, codesWithFrequency, cooccurrence, saturation } = store;

  let activeTab = $state<"coding" | "memos" | "relations" | "actors" | "analysis">("coding");
  let newCodeName = $state("");
  let newCodeLevel = $state<1 | 2 | 3>(1);
  let newCodeParent = $state<string | null>(null);
  let newMemoContent = $state("");
  let newMemoType = $state<Memo["memoType"]>("observational");
  let newRelationFrom = $state<string | null>(null);
  let newRelationTo = $state<string | null>(null);
  let newRelationType = $state("associates-with");
  let newActorName = $state("");
  let newActorType = $state<"human" | "non-human" | "hybrid">("human");
  let newActorRole = $state<"intermediary" | "mediator">("intermediary");
  let newActorLinkFrom = $state<string | null>(null);
  let newActorLinkTo = $state<string | null>(null);
  let newActorLinkType = $state("translation");
  let newColumnName = $state("");
  let newColumnType = $state("VARCHAR");

  function createCode() {
    let name = newCodeName.trim();
    if (!name) {
      return;
    }
    store.createCode({
      name,
      level: newCodeLevel,
      parentId: newCodeParent ?? undefined,
    });
    newCodeName = "";
  }

  function createMemo() {
    let content = newMemoContent.trim();
    if (!content) {
      return;
    }
    store.createMemo({
      content,
      linkedCodes: [],
      linkedDataPoints: $selectedRows ?? [],
      memoType: newMemoType,
      tags: [],
    });
    newMemoContent = "";
  }

  function downloadRefiQda() {
    let xml = store.exportRefiQda();
    downloadBuffer(new TextEncoder().encode(xml), "coding.refi-qda.xml");
  }

  async function addColumn() {
    let name = newColumnName.trim();
    if (!name) {
      return;
    }
    await context.coordinator.exec(
      `ALTER TABLE ${context.table} ADD COLUMN IF NOT EXISTS ${SQL.column(name)} ${newColumnType}`,
    );
    newColumnName = "";
    await onRefreshColumns();
  }

  function flatCodes(
    codes: Code[],
    parentId: string | null = null,
    depth = 0,
  ): Array<{ code: Code; depth: number }> {
    return codes
      .filter((code) => (code.parentId ?? null) === parentId)
      .flatMap((code) => [{ code, depth }, ...flatCodes(codes, code.id, depth + 1)]);
  }
</script>

<aside
  class="fixed right-4 top-24 bottom-6 w-[360px] z-30 rounded-lg border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-lg flex flex-col"
>
  <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
    <div class="font-semibold text-slate-800 dark:text-slate-100">Qualitative Coding</div>
    <Button label="Details" onClick={onShowDetails} />
  </div>
  <div class="flex gap-2 px-3 py-2 text-sm border-b border-slate-200 dark:border-slate-700">
    {#each ["coding", "memos", "relations", "actors", "analysis"] as tab}
      <button
        class="px-2 py-1 rounded-md text-slate-500 dark:text-slate-400"
        class:text-slate-900={activeTab === tab}
        class:dark:text-white={activeTab === tab}
        onclick={() => (activeTab = tab as any)}
      >
        {tab}
      </button>
    {/each}
  </div>
  <div class="flex-1 overflow-y-auto p-3 space-y-4">
    {#if activeTab === "coding"}
      <div class="space-y-2">
        <div class="text-xs uppercase text-slate-400">Selected</div>
        <div class="text-sm text-slate-600 dark:text-slate-300">
          {$selectedRows?.length ?? 0} item{$selectedRows?.length === 1 ? "" : "s"} selected
        </div>
        <div class="flex gap-2">
          <Input placeholder="New code name" bind:value={newCodeName} />
          <Button label="Add" onClick={createCode} />
        </div>
        <div class="flex gap-2">
          <Select
            label="Level"
            value={newCodeLevel}
            onChange={(v) => (newCodeLevel = v as any)}
            options={[
              { value: 1, label: "Open" },
              { value: 2, label: "Axial" },
              { value: 3, label: "Selective" },
            ]}
          />
          <Select
            label="Parent"
            value={newCodeParent}
            onChange={(v) => (newCodeParent = v)}
            options={[{ value: null, label: "None" }, ...$codes.map((code) => ({ value: code.id, label: code.name }))]}
          />
        </div>
      </div>
      <div class="space-y-2">
        <div class="text-xs uppercase text-slate-400">Code Hierarchy</div>
        {#if $codesWithFrequency.length === 0}
          <div class="text-sm text-slate-500">No codes yet.</div>
        {:else}
          {#each flatCodes($codesWithFrequency) as item (item.code.id)}
            <div class="flex items-center justify-between text-sm" style:padding-left={`${item.depth * 12}px`}>
              <div class="flex items-center gap-2">
                <span class="w-3 h-3 rounded-full" style:background-color={item.code.color}></span>
                <span>{item.code.name}</span>
                <span class="text-xs text-slate-400">({item.code.frequency})</span>
              </div>
              <div class="flex gap-1">
                <button
                  class="text-xs text-blue-600"
                  onclick={() => store.applyCode(item.code.id, $selectedRows ?? [])}
                >
                  Apply
                </button>
                <button
                  class="text-xs text-slate-500"
                  onclick={() => store.removeCode(item.code.id, $selectedRows ?? [])}
                >
                  Remove
                </button>
              </div>
            </div>
          {/each}
        {/if}
      </div>
      <div class="space-y-2">
        <div class="text-xs uppercase text-slate-400">Add Column</div>
        <div class="flex gap-2">
          <Input placeholder="Column name" bind:value={newColumnName} />
          <Select
            value={newColumnType}
            onChange={(v) => (newColumnType = v)}
            options={[
              { value: "VARCHAR", label: "Text" },
              { value: "DOUBLE", label: "Number" },
              { value: "BOOLEAN", label: "Boolean" },
            ]}
          />
        </div>
        <Button label="Add Column" onClick={addColumn} />
      </div>
    {:else if activeTab === "memos"}
      <div class="space-y-2">
        <div class="text-xs uppercase text-slate-400">New Memo</div>
        <textarea
          class="w-full min-h-[80px] border border-slate-300 dark:border-slate-700 rounded-md p-2 bg-white dark:bg-slate-900"
          bind:value={newMemoContent}
        ></textarea>
        <div class="flex gap-2">
          <Select
            value={newMemoType}
            onChange={(v) => (newMemoType = v as Memo["memoType"])}
            options={[
              { value: "observational", label: "Observational" },
              { value: "methodological", label: "Methodological" },
              { value: "theoretical", label: "Theoretical" },
            ]}
          />
          <Button label="Save Memo" onClick={createMemo} />
        </div>
      </div>
      <div class="space-y-2">
        <div class="text-xs uppercase text-slate-400">Memos</div>
        {#each $memos as memo (memo.id)}
          <div class="border border-slate-200 dark:border-slate-700 rounded-md p-2 text-sm">
            <div class="text-xs text-slate-400">{memo.memoType}</div>
            <div class="text-slate-700 dark:text-slate-200">{memo.content}</div>
            <div class="text-xs text-slate-400">{memo.createdAt.toLocaleString()}</div>
          </div>
        {/each}
      </div>
    {:else if activeTab === "relations"}
      <div class="space-y-2">
        <div class="text-xs uppercase text-slate-400">Code Relations</div>
        <Select
          label="From"
          value={newRelationFrom}
          onChange={(v) => (newRelationFrom = v)}
          options={[{ value: null, label: "Select" }, ...$codes.map((code) => ({ value: code.id, label: code.name }))]}
        />
        <Select
          label="To"
          value={newRelationTo}
          onChange={(v) => (newRelationTo = v)}
          options={[{ value: null, label: "Select" }, ...$codes.map((code) => ({ value: code.id, label: code.name }))]}
        />
        <Select
          label="Type"
          value={newRelationType}
          onChange={(v) => (newRelationType = v)}
          options={[
            { value: "is-a", label: "is-a" },
            { value: "part-of", label: "part-of" },
            { value: "causes", label: "causes" },
            { value: "contradicts", label: "contradicts" },
            { value: "associates-with", label: "associates-with" },
          ]}
        />
        <Button
          label="Add Relation"
          onClick={() => {
            if (newRelationFrom && newRelationTo) {
              store.createRelation({ fromCode: newRelationFrom, toCode: newRelationTo, relationType: newRelationType });
              newRelationFrom = null;
              newRelationTo = null;
            }
          }}
        />
        <div class="space-y-1">
          {#each $relations as rel (rel.id)}
            <div class="text-sm text-slate-600 dark:text-slate-300">
              {rel.fromCode} → {rel.toCode} ({rel.relationType})
            </div>
          {/each}
        </div>
      </div>
    {:else if activeTab === "actors"}
      <div class="space-y-2">
        <div class="text-xs uppercase text-slate-400">Actor Registry</div>
        <Input placeholder="Actor name" bind:value={newActorName} />
        <Select
          value={newActorType}
          onChange={(v) => (newActorType = v as any)}
          options={[
            { value: "human", label: "Human" },
            { value: "non-human", label: "Non-human" },
            { value: "hybrid", label: "Hybrid" },
          ]}
        />
        <Select
          value={newActorRole}
          onChange={(v) => (newActorRole = v as any)}
          options={[
            { value: "intermediary", label: "Intermediary" },
            { value: "mediator", label: "Mediator" },
          ]}
        />
        <Button
          label="Add Actor"
          onClick={() => {
            if (!newActorName.trim()) return;
            store.addActor({
              name: newActorName.trim(),
              actorType: newActorType,
              role: newActorRole,
            });
            newActorName = "";
          }}
        />
        <div class="space-y-1">
          {#each $actors as actor (actor.id)}
            <div class="text-sm text-slate-600 dark:text-slate-300">
              {actor.name} ({actor.actorType}, {actor.role})
            </div>
          {/each}
        </div>
        <div class="text-xs uppercase text-slate-400 pt-2">Actor Links</div>
        <Select
          label="From"
          value={newActorLinkFrom}
          onChange={(v) => (newActorLinkFrom = v)}
          options={[{ value: null, label: "Select" }, ...$actors.map((actor) => ({ value: actor.id, label: actor.name }))]}
        />
        <Select
          label="To"
          value={newActorLinkTo}
          onChange={(v) => (newActorLinkTo = v)}
          options={[{ value: null, label: "Select" }, ...$actors.map((actor) => ({ value: actor.id, label: actor.name }))]}
        />
        <Input placeholder="Translation type" bind:value={newActorLinkType} />
        <Button
          label="Add Link"
          onClick={() => {
            if (newActorLinkFrom && newActorLinkTo) {
              store.addActorLink({
                fromActor: newActorLinkFrom,
                toActor: newActorLinkTo,
                translationType: newActorLinkType,
                dataPointIds: $selectedRows ?? [],
              });
              newActorLinkFrom = null;
              newActorLinkTo = null;
            }
          }}
        />
      </div>
    {:else if activeTab === "analysis"}
      <div class="space-y-2">
        <div class="text-xs uppercase text-slate-400">Saturation</div>
        <div class="text-sm text-slate-600 dark:text-slate-300">
          Total codes: {$saturation.totalCodes}
        </div>
        <div class="text-sm text-slate-600 dark:text-slate-300">
          New codes (last 50 events): {$saturation.recentNewCodes}
        </div>
        <div class="text-sm text-slate-600 dark:text-slate-300">Trend: {$saturation.trend}</div>
      </div>
      <div class="space-y-2">
        <div class="text-xs uppercase text-slate-400">Co-occurrence</div>
        {#each Object.entries($cooccurrence) as [codeId, relations]}
          <div class="text-sm text-slate-600 dark:text-slate-300">
            {codeId}: {Object.entries(relations).map(([other, count]) => `${other} (${count})`).join(", ")}
          </div>
        {/each}
      </div>
      <div class="space-y-2">
        <div class="text-xs uppercase text-slate-400">Export</div>
        <Button label="Export REFI-QDA" onClick={downloadRefiQda} />
      </div>
    {/if}
  </div>
</aside>
