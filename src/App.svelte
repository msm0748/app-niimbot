<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { Bluetooth, Check, PlugZap, Printer, RotateCcw, Search, Trash2 } from '@lucide/svelte'
  import LabelPreview from './lib/LabelPreview.svelte'
  import Modal from './lib/Modal.svelte'
  import {
    deleteHistoryItem,
    hasDuplicateText,
    loadHistory,
    saveHistory,
    upsertHistory,
  } from './lib/history'
  import { makeBitmap, normalizeLabelText } from './lib/label'
  import { createPrinter } from './lib/printer'
  import { LABEL_SIZES, type LabelSize, type PrintHistoryItem, type PrinterStatus } from './lib/types'

  const printer = createPrinter()

  let text = $state('')
  let labelSize = $state<LabelSize>('12x22')
  let quantity = $state(1)
  let isComposing = $state(false)
  let isConnecting = $state(false)
  let isScanning = $state(false)
  let isPrinting = $state(false)
  let status = $state<PrinterStatus>({ connected: false })
  let errorMessage = $state('')
  let history = $state<PrintHistoryItem[]>([])
  let scanResults = $state<{ name: string; services: string[]; matched: boolean }[]>([])
  let textInput: HTMLInputElement
  let modal = $state<
    | { kind: 'duplicate'; text: string }
    | { kind: 'delete-one'; item: PrintHistoryItem }
    | { kind: 'delete-all' }
    | null
  >(null)

  const canPrint = $derived(Boolean(normalizeLabelText(text)) && !isPrinting)

  onMount(async () => {
    history = loadHistory()
    try {
      status = await printer.getStatus()
    } catch {
      status = { connected: false }
    }
    await focusText()
  })

  async function focusText() {
    await tick()
    textInput?.focus()
  }

  async function connect() {
    isConnecting = true
    errorMessage = ''
    try {
      status = await printer.scanAndConnect()
    } catch (error) {
      errorMessage = formatError(error)
      status = { connected: false }
    } finally {
      isConnecting = false
    }
  }

  async function scanOnly() {
    isScanning = true
    errorMessage = ''
    scanResults = []
    try {
      scanResults = await printer.scanPrinters()
      if (scanResults.length === 0) {
        errorMessage =
          'No BLE peripherals were visible. Check macOS Bluetooth permission and keep D11_H awake near the Mac.'
      }
    } catch (error) {
      errorMessage = formatError(error)
    } finally {
      isScanning = false
    }
  }

  async function print() {
    const normalized = normalizeLabelText(text)
    if (!normalized || isPrinting) return

    if (hasDuplicateText(history, normalized)) {
      modal = { kind: 'duplicate', text: normalized }
      return
    }

    isPrinting = true
    errorMessage = ''

    try {
      const bitmap = makeBitmap(normalized, labelSize)
      await printer.printLabel(bitmap, clampQuantity(quantity), labelSize)
      history = upsertHistory(history, normalized, labelSize)
      saveHistory(history)
      text = ''
      quantity = 1
      await focusText()
    } catch (error) {
      errorMessage = formatError(error)
    } finally {
      isPrinting = false
    }
  }

  function onTextKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !isComposing && !event.isComposing) {
      event.preventDefault()
      print()
    }
  }

  function recall(item: PrintHistoryItem) {
    text = item.text
    labelSize = item.labelSize
    focusText()
  }

  function confirmModal() {
    if (!modal) return
    if (modal.kind === 'delete-all') {
      history = []
      saveHistory(history)
    }
    if (modal.kind === 'delete-one') {
      history = deleteHistoryItem(history, modal.item)
      saveHistory(history)
    }
    modal = null
    focusText()
  }

  function closeModal() {
    modal = null
    focusText()
  }

  function clampQuantity(value: number) {
    return Math.min(20, Math.max(1, Math.trunc(value || 1)))
  }

  function formatError(error: unknown) {
    if (typeof error === 'string') return error
    if (error instanceof Error) return error.message
    return 'Unexpected printer error'
  }
</script>

<main class="app-shell min-h-screen px-10 py-8">
  <div class="mx-auto grid max-w-[1220px] grid-cols-[minmax(620px,1fr)_360px] gap-6">
    <section class="surface-panel overflow-hidden">
      <header class="flex items-center justify-between gap-6 border-b border-zinc-200/80 px-6 py-5">
        <div class="min-w-0">
          <div class="flex items-center gap-3">
            <p class="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-700">NIIMBOT D11_H</p>
            <span class="h-1 w-1 rounded-full bg-zinc-300"></span>
            <p class="text-xs font-semibold text-zinc-500">macOS CoreBluetooth</p>
          </div>
          <h1 class="mt-1 truncate text-[28px] font-bold leading-tight text-zinc-950">Label Console</h1>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <span class={status.connected ? 'status-pill connected' : 'status-pill'}>
            {#if status.connected}<Check size={14} />{/if}
            {status.connected ? status.deviceName || 'Connected' : 'Disconnected'}
          </span>
          <button class="control-button primary" onclick={connect} disabled={isConnecting}>
            {#if isConnecting}
              <span class="loading loading-spinner loading-xs"></span>
            {:else}
              <Bluetooth size={17} />
            {/if}
            Connect
          </button>
          <button class="control-button" onclick={scanOnly} disabled={isScanning}>
            {#if isScanning}
              <span class="loading loading-spinner loading-xs"></span>
            {:else}
              <Search size={17} />
            {/if}
            Scan
          </button>
        </div>
      </header>

      <div class="grid grid-cols-[minmax(0,1fr)_300px] gap-6 px-6 py-6">
        <div class="space-y-5">
          <label class="block">
            <span class="field-label">Text</span>
            <input
              bind:this={textInput}
              bind:value={text}
              class="label-input"
              placeholder="라벨 이름"
              onkeydown={onTextKeydown}
              oncompositionstart={() => (isComposing = true)}
              oncompositionend={() => (isComposing = false)}
            />
          </label>

          <div class="grid grid-cols-[1fr_150px] gap-4">
            <label class="block">
              <span class="field-label">Label size</span>
              <select bind:value={labelSize} class="field-control">
                {#each Object.values(LABEL_SIZES) as size}
                  <option value={size.id}>{size.name}</option>
                {/each}
              </select>
            </label>

            <label class="block">
              <span class="field-label">Quantity</span>
              <input
                bind:value={quantity}
                class="field-control"
                type="number"
                min="1"
                max="20"
                onblur={() => (quantity = clampQuantity(quantity))}
              />
            </label>
          </div>

          {#if errorMessage}
            <div class="alert alert-error py-3 text-sm">
              <PlugZap size={17} />
              <span>{errorMessage}</span>
            </div>
          {/if}

          {#if scanResults.length > 0}
            <div class="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left text-xs text-zinc-600">
              <div class="mb-2 font-bold text-zinc-900">Scan results</div>
              <div class="max-h-28 space-y-1 overflow-auto">
                {#each scanResults as item}
                  <div>
                    <span class={item.matched ? 'font-bold text-teal-700' : 'font-medium'}>
                      {item.name}
                    </span>
                    {#if item.services.length > 0}
                      <span class="text-zinc-400"> · {item.services.join(', ')}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <button class="print-button" onclick={print} disabled={!canPrint}>
            {#if isPrinting}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Printer size={20} />
            {/if}
            Print Label
          </button>
        </div>

        <aside class="preview-column">
          <div class="mb-3 flex items-end justify-between">
            <div>
              <p class="field-label mb-0">Preview</p>
              <p class="text-xs font-semibold text-zinc-400">{LABEL_SIZES[labelSize].name}</p>
            </div>
            <span class="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-500">
              {LABEL_SIZES[labelSize].width} x {LABEL_SIZES[labelSize].height}px
            </span>
          </div>
          <LabelPreview {text} {labelSize} />
        </aside>
      </div>
    </section>

    <aside class="surface-panel flex min-h-[520px] flex-col px-5 py-5">
      <div class="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 class="text-xl font-bold text-zinc-950">History</h2>
          <p class="text-xs font-semibold text-zinc-400">{history.length} saved labels</p>
        </div>
        <button
          class="icon-command"
          onclick={() => (modal = { kind: 'delete-all' })}
          disabled={history.length === 0}
          title="Delete all"
        >
          <RotateCcw size={17} />
          Clear
        </button>
      </div>

      <div class="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
        {#if history.length === 0}
          <p class="rounded-md border border-dashed border-zinc-300 p-5 text-center text-sm font-semibold text-zinc-400">
            Printed labels will appear here.
          </p>
        {:else}
          {#each history as item (item.text + item.labelSize)}
            <div class="history-row">
              <button class="min-w-0 flex-1 text-left" onclick={() => recall(item)}>
                <div class="truncate text-base font-bold text-zinc-950">{item.text}</div>
                <div class="mt-1 text-xs font-semibold text-zinc-400">
                  {LABEL_SIZES[item.labelSize].name} · {new Date(item.printedAt).toLocaleString()}
                </div>
              </button>
              <button
                class="delete-button"
                aria-label={`Delete ${item.text}`}
                onclick={() => (modal = { kind: 'delete-one', item })}
              >
                <Trash2 size={17} />
              </button>
            </div>
          {/each}
        {/if}
      </div>
    </aside>
  </div>
</main>

{#if modal}
  {#if modal.kind === 'duplicate'}
    <Modal
      title="Same name already exists"
      message={`'${modal.text}' is already saved in print history. Printing was blocked to prevent duplicates.`}
      onCancel={closeModal}
    />
  {:else if modal.kind === 'delete-one'}
    <Modal
      title="Delete history item?"
      message={`Delete '${modal.item.text}' from print history?`}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      destructive
      onCancel={closeModal}
      onConfirm={confirmModal}
    />
  {:else}
    <Modal
      title="Delete all history?"
      message="This removes every saved print history item from this Mac."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      destructive
      onCancel={closeModal}
      onConfirm={confirmModal}
    />
  {/if}
{/if}
