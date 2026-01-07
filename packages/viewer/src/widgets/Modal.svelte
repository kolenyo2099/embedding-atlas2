<!-- Copyright (c) 2025 Apple Inc. Licensed under MIT License. -->
<script lang="ts">
  import { fade } from "svelte/transition";

  interface Props {
    open: boolean;
    title?: string;
    onClose: () => void;
  }

  let { open, title, onClose }: Props = $props();
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center" transition:fade>
    <div
      class="absolute inset-0 bg-black/40"
      onclick={() => {
        onClose();
      }}
    ></div>
    <div
      class="relative w-[48rem] max-w-[90vw] max-h-[90vh] overflow-hidden rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div class="text-slate-800 dark:text-slate-100 font-semibold">{title}</div>
        <button class="text-slate-500 hover:text-slate-900" onclick={onClose}>✕</button>
      </div>
      <div class="p-4 overflow-y-auto max-h-[70vh]">
        <slot />
      </div>
    </div>
  </div>
{/if}
