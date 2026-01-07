<!-- Copyright (c) 2025 Apple Inc. Licensed under MIT License. -->
<script lang="ts">
  import * as SQL from "@uwdata/mosaic-sql";

  import ContentRenderer from "../renderers/ContentRenderer.svelte";
  import type { ChartContext, RowID } from "../charts/chart.js";
  import Modal from "../widgets/Modal.svelte";

  interface Props {
    context: ChartContext;
    rowId: RowID | null;
    open: boolean;
    onClose: () => void;
  }

  let { context, rowId, open, onClose }: Props = $props();

  let rowData = $state<Record<string, any> | null>(null);
  let loading = $state(false);
  let columnStyles = context.columnStyles;

  $effect.pre(() => {
    if (!open || rowId == null) {
      rowData = null;
      return;
    }
    let isCancelled = false;
    loading = true;
    const columns = context.columns.map((c) => c.name);
    context.coordinator
      .query(
        SQL.Query.from(context.table)
          .select(Object.fromEntries(columns.map((name) => [name, SQL.column(name)])))
          .where(SQL.eq(SQL.column(context.id), SQL.literal(rowId))),
      )
      .then((result) => {
        if (isCancelled) {
          return;
        }
        rowData = result.get(0) ?? null;
      })
      .finally(() => {
        if (!isCancelled) {
          loading = false;
        }
      });
    return () => {
      isCancelled = true;
    };
  });
</script>

<Modal open={open} title="Point Details" onClose={onClose}>
  {#if rowId == null}
    <div class="text-slate-500 dark:text-slate-400">Select a point to see details.</div>
  {:else if loading}
    <div class="text-slate-500 dark:text-slate-400">Loading details...</div>
  {:else if rowData == null}
    <div class="text-slate-500 dark:text-slate-400">No details available.</div>
  {:else}
    <div class="space-y-3">
      {#each context.columns as column}
        <div class="flex flex-col gap-1 border-b border-slate-200 dark:border-slate-700 pb-2">
          <div class="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{column.name}</div>
          <ContentRenderer value={rowData[column.name]} renderer={$columnStyles[column.name]?.renderer} />
        </div>
      {/each}
    </div>
  {/if}
</Modal>
