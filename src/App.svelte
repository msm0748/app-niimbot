<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { Bluetooth, Check, PlugZap, Printer, RotateCcw, Trash2 } from '@lucide/svelte'
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

  function clampQuantity(value: number) {
    return Math.min(20, Math.max(1, Math.trunc(value || 1)))
  }

  function formatError(error: unknown) {
    if (typeof error === 'string') return error
    if (error instanceof Error) return error.message
    return 'Unexpected printer error'
  }
</script>

<main class="app-shell min-h-screen p-6">
  <div class="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_340px] gap-5">
    <section class="rounded-lg border border-stone-200 bg-white/88 p-5 shadow-xl shadow-stone-900/5">
      <header class="flex items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">macOS CoreBluetooth</p>
          <h1 class="mt-1 text-2xl font-semibold text-stone-950">NIIMBOT D11_H Label Printer</h1>
        </div>
        <div class="flex items-center gap-2">
          <span class={status.connected ? 'badge badge-success gap-1' : 'badge badge-outline gap-1'}>
            {#if status.connected}<Check size={13} />{/if}
            {status.connected ? status.deviceName || 'Connected' : 'Disconnected'}
          </span>
          <button class="btn btn-neutral btn-sm gap-2" onclick={connect} disabled={isConnecting}>
            {#if isConnecting}
              <span class="loading loading-spinner loading-xs"></span>
            {:else}
              <Bluetooth size={16} />
            {/if}
            Connect
          </button>
          <button class="btn btn-outline btn-sm gap-2" onclick={scanOnly} disabled={isScanning}>
            {#if isScanning}
              <span class="loading loading-spinner loading-xs"></span>
            {:else}
              <Bluetooth size={16} />
            {/if}
            Scan
          </button>
        </div>
      </header>

      <div class="mt-5 grid grid-cols-[1fr_260px] gap-5">
        <div class="space-y-4">
          <label class="form-control">
            <span class="label pb-1 text-xs font-semibold text-stone-600">Text</span>
            <input
              bind:this={textInput}
              bind:value={text}
              class="input input-bordered h-14 text-2xl font-semibold"
              placeholder="라벨 이름"
              onkeydown={onTextKeydown}
              oncompositionstart={() => (isComposing = true)}
              oncompositionend={() => (isComposing = false)}
            />
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="form-control">
              <span class="label pb-1 text-xs font-semibold text-stone-600">Label size</span>
              <select bind:value={labelSize} class="select select-bordered">
                {#each Object.values(LABEL_SIZES) as size}
                  <option value={size.id}>{size.name}</option>
                {/each}
              </select>
            </label>

            <label class="form-control">
              <span class="label pb-1 text-xs font-semibold text-stone-600">Quantity</span>
              <input
                bind:value={quantity}
                class="input input-bordered"
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
            <div class="rounded-lg border border-stone-200 bg-stone-50 p-3 text-left text-xs text-stone-600">
              <div class="mb-2 font-semibold text-stone-900">Scan results</div>
              <div class="space-y-1">
                {#each scanResults as item}
                  <div>
                    <span class={item.matched ? 'font-bold text-emerald-700' : 'font-medium'}>
                      {item.name}
                    </span>
                    {#if item.services.length > 0}
                      <span class="text-stone-400"> · {item.services.join(', ')}</span>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <button class="btn btn-success w-full gap-2 text-white" onclick={print} disabled={!canPrint}>
            {#if isPrinting}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Printer size={18} />
            {/if}
            Print
          </button>
        </div>

        <aside>
          <div class="mb-2 flex items-center justify-between text-xs font-semibold text-stone-600">
            <span>Preview</span>
            <span>{LABEL_SIZES[labelSize].width} x {LABEL_SIZES[labelSize].height}px</span>
          </div>
          <LabelPreview {text} {labelSize} />
        </aside>
      </div>
    </section>

    <aside class="rounded-lg border border-stone-200 bg-white/88 p-4 shadow-xl shadow-stone-900/5">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-base font-semibold text-stone-950">Print History</h2>
        <button
          class="btn btn-ghost btn-xs gap-1"
          onclick={() => (modal = { kind: 'delete-all' })}
          disabled={history.length === 0}
          title="Delete all"
        >
          <RotateCcw size={14} />
          Clear
        </button>
      </div>

      <div class="max-h-[calc(100vh-8rem)] space-y-2 overflow-auto pr-1">
        {#if history.length === 0}
          <p class="rounded-lg border border-dashed border-stone-300 p-5 text-center text-sm text-stone-500">
            Printed labels will appear here.
          </p>
        {:else}
          {#each history as item (item.text + item.labelSize)}
            <div class="group flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 p-2">
              <button class="min-w-0 flex-1 text-left" onclick={() => recall(item)}>
                <div class="truncate text-sm font-semibold text-stone-950">{item.text}</div>
                <div class="mt-0.5 text-xs text-stone-500">
                  {LABEL_SIZES[item.labelSize].name} · {new Date(item.printedAt).toLocaleString()}
                </div>
              </button>
              <button
                class="btn btn-ghost btn-xs btn-square"
                aria-label={`Delete ${item.text}`}
                onclick={() => (modal = { kind: 'delete-one', item })}
              >
                <Trash2 size={14} />
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
      onCancel={() => (modal = null)}
    />
  {:else if modal.kind === 'delete-one'}
    <Modal
      title="Delete history item?"
      message={`Delete '${modal.item.text}' from print history?`}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      destructive
      onCancel={() => (modal = null)}
      onConfirm={confirmModal}
    />
  {:else}
    <Modal
      title="Delete all history?"
      message="This removes every saved print history item from this Mac."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      destructive
      onCancel={() => (modal = null)}
      onConfirm={confirmModal}
    />
  {/if}
{/if}
