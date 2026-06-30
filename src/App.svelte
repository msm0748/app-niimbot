<script lang="ts">
  import { onMount, tick } from 'svelte'
  import {
    Button,
    InlineNotification,
    NumberInput,
    Select,
    SelectItem,
    Tag,
    TextInput,
    Tile,
  } from 'carbon-components-svelte'
  import Bluetooth from 'carbon-icons-svelte/lib/Bluetooth.svelte'
  import Checkmark from 'carbon-icons-svelte/lib/Checkmark.svelte'
  import Printer from 'carbon-icons-svelte/lib/Printer.svelte'
  import Renew from 'carbon-icons-svelte/lib/Renew.svelte'
  import Search from 'carbon-icons-svelte/lib/Search.svelte'
  import TrashCan from 'carbon-icons-svelte/lib/TrashCan.svelte'
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
  let quantity = $state<number | null>(1)
  let isComposing = $state(false)
  let isConnecting = $state(false)
  let isScanning = $state(false)
  let isPrinting = $state(false)
  let status = $state<PrinterStatus>({ connected: false })
  let errorMessage = $state('')
  let history = $state<PrintHistoryItem[]>([])
  let scanResults = $state<{ name: string; services: string[]; matched: boolean }[]>([])
  let textInput = $state<HTMLInputElement | null>(null)
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

  function clampQuantity(value: number | null) {
    return Math.min(20, Math.max(1, Math.trunc(value || 1)))
  }

  function formatError(error: unknown) {
    if (typeof error === 'string') return error
    if (error instanceof Error) return error.message
    return 'Unexpected printer error'
  }
</script>

<main class="app-shell">
  <section class="workspace">
    <div class="main-panel">
      <header class="app-header">
        <div class="title-block">
          <p class="eyebrow">NIIMBOT D11_H</p>
          <h1>Label Console</h1>
          <p class="subtitle">macOS CoreBluetooth label printing utility</p>
        </div>

        <div class="connection-actions">
          <Tag type={status.connected ? 'green' : 'outline'} size="sm">
            {#if status.connected}<Checkmark size={14} />{/if}
            {status.connected ? status.deviceName || 'Connected' : 'Disconnected'}
          </Tag>
          <Button size="field" kind="primary" icon={Bluetooth} disabled={isConnecting} onclick={connect}>
            {isConnecting ? 'Connecting' : 'Connect'}
          </Button>
          <Button size="field" kind="secondary" icon={Search} disabled={isScanning} onclick={scanOnly}>
            {isScanning ? 'Scanning' : 'Scan'}
          </Button>
        </div>
      </header>

      <div class="console-grid">
        <Tile class="print-card">
          <div class="form-stack">
            <div
              oncompositionstart={() => (isComposing = true)}
              oncompositionend={() => (isComposing = false)}
            >
              <TextInput
                bind:value={text}
                bind:ref={textInput}
                size="xl"
                labelText="Text"
                placeholder="라벨 이름"
                on:keydown={onTextKeydown}
              />
            </div>

            <div class="field-grid">
              <Select bind:selected={labelSize} labelText="Label size" size="xl">
                {#each Object.values(LABEL_SIZES) as size}
                  <SelectItem value={size.id} text={size.name} />
                {/each}
              </Select>

              <NumberInput
                bind:value={quantity}
                labelText="Quantity"
                min={1}
                max={20}
                step={1}
                size="xl"
                on:blur={() => (quantity = clampQuantity(quantity))}
              />
            </div>

            {#if errorMessage}
              <InlineNotification
                kind="error"
                lowContrast
                title="Printer error"
                subtitle={errorMessage}
                hideCloseButton
              />
            {/if}

            {#if scanResults.length > 0}
              <div class="scan-panel">
                <div class="scan-title">Scan results</div>
                <div class="scan-list">
                  {#each scanResults as item}
                    <div class:matched={item.matched} class="scan-item">
                      <span>{item.name}</span>
                      {#if item.services.length > 0}
                        <small>{item.services.join(', ')}</small>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}

            <Button
              class="print-action"
              size="xl"
              kind="primary"
              icon={Printer}
              disabled={!canPrint}
              onclick={print}
            >
              {isPrinting ? 'Printing' : 'Print Label'}
            </Button>
          </div>
        </Tile>

        <Tile class="preview-card">
          <div class="preview-head">
            <div>
              <p class="section-label">Preview</p>
              <p class="preview-size">{LABEL_SIZES[labelSize].name}</p>
            </div>
            <Tag type="cool-gray" size="sm" inline>
              {LABEL_SIZES[labelSize].width} x {LABEL_SIZES[labelSize].height}px
            </Tag>
          </div>
          <LabelPreview {text} {labelSize} />
        </Tile>
      </div>
    </div>

    <Tile class="history-panel">
      <div class="history-head">
        <div>
          <h2>History</h2>
          <p>{history.length} saved labels</p>
        </div>
        <Button
          kind="ghost"
          size="small"
          icon={Renew}
          disabled={history.length === 0}
          onclick={() => (modal = { kind: 'delete-all' })}
        >
          Clear
        </Button>
      </div>

      <div class="history-list">
        {#if history.length === 0}
          <div class="empty-history">Printed labels will appear here.</div>
        {:else}
          {#each history as item (item.text + item.labelSize)}
            <div class="history-item">
              <button class="history-recall" onclick={() => recall(item)}>
                <strong>{item.text}</strong>
                <span>{LABEL_SIZES[item.labelSize].name} · {new Date(item.printedAt).toLocaleString()}</span>
              </button>
              <Button
                kind="ghost"
                size="small"
                icon={TrashCan}
                iconDescription={`Delete ${item.text}`}
                onclick={() => (modal = { kind: 'delete-one', item })}
              />
            </div>
          {/each}
        {/if}
      </div>
    </Tile>
  </section>
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
