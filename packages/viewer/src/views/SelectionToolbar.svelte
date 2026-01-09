<!-- Copyright (c) 2025 Apple Inc. Licensed under MIT License. -->
<script lang="ts">
  import type { Writable } from "svelte/store";

  import Select from "../widgets/Select.svelte";

  interface Props {
    selectedRows: Writable<any[] | null>;
    codes: Writable<{ id: string; name: string }[]>;
    onApply: (codeId: string, rows: any[]) => void;
    onAddMemo: (rows: any[]) => void;
  }

  let { selectedRows, codes, onApply, onAddMemo }: Props = $props();

  let selectedCode = $state<string | null>(null);
</script>

{#if $selectedRows != null && $selectedRows.length > 0}
  <div
    class="fixed left-1/2 -translate-x-1/2 bottom-6 z-40 flex items-center gap-3 px-4 py-2 rounded-full shadow-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
  >
    <div class="text-sm text-slate-600 dark:text-slate-300">
      {$selectedRows.length} item{$selectedRows.length === 1 ? "" : "s"} selected
    </div>
    <Select
      class="min-w-[200px]"
      value={selectedCode}
      onChange={(v) => (selectedCode = v)}
      options={[{ value: null, label: "Apply code..." }, ...$codes.map((code) => ({ value: code.id, label: code.name }))]}
    />
    <button
      class="px-3 py-1 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
      disabled={selectedCode == null}
      onclick={() => {
        if (selectedCode != null) {
          onApply(selectedCode, $selectedRows ?? []);
          selectedCode = null;
        }
      }}
    >
      Apply
    </button>
    <button
      class="px-3 py-1 rounded-md text-sm border border-slate-200 dark:border-slate-700"
      onclick={() => onAddMemo($selectedRows ?? [])}
    >
      Add Memo
    </button>
    <button class="px-3 py-1 rounded-md text-sm" onclick={() => selectedRows.set(null)}>Clear</button>
  </div>
{/if}
