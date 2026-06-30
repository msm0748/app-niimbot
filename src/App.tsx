import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  MantineProvider,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  createTheme,
} from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import {
  IconBluetooth,
  IconBluetoothOff,
  IconCheck,
  IconPrinter,
  IconRefresh,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ConfirmModal from './lib/ConfirmModal'
import LabelPreview from './lib/LabelPreview'
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

const theme = createTheme({
  primaryColor: 'teal',
  fontFamily:
    '"Avenir Next", "Apple SD Gothic Neo", "SF Pro Text", -apple-system, BlinkMacSystemFont, sans-serif',
  headings: {
    fontFamily:
      '"Avenir Next", "Apple SD Gothic Neo", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
    fontWeight: '600',
  },
  defaultRadius: 'md',
})

type ModalState =
  | { kind: 'duplicate'; text: string }
  | { kind: 'delete-one'; item: PrintHistoryItem }
  | { kind: 'delete-all' }
  | null

const labelOptions = Object.values(LABEL_SIZES).map((size) => ({
  value: size.id,
  label: size.name,
}))

export default function App() {
  const [text, setText] = useState('')
  const [labelSize, setLabelSize] = useState<LabelSize>('12x22')
  const [quantity, setQuantity] = useState<number | string>(1)
  const [isComposing, setIsComposing] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [status, setStatus] = useState<PrinterStatus>({ connected: false })
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [history, setHistory] = useState<PrintHistoryItem[]>([])
  const [scanResults, setScanResults] = useState<{ name: string; services: string[]; matched: boolean }[]>([])
  const [modal, setModal] = useState<ModalState>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef(status)
  const normalizedText = normalizeLabelText(text)
  const currentSize = LABEL_SIZES[labelSize]

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const focusText = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const next = await printer.getStatus()
      if (statusRef.current.connected && !next.connected) {
        setStatusMessage('Printer disconnected.')
      }
      setStatus(next)
    } catch {
      if (statusRef.current.connected) {
        setStatusMessage('Printer disconnected.')
      }
      setStatus({ connected: false })
    }
  }, [])

  useEffect(() => {
    setHistory(loadHistory())
    void refreshStatus()
    focusText()
    const timer = window.setInterval(refreshStatus, 2500)
    return () => window.clearInterval(timer)
  }, [focusText, refreshStatus])

  const modalContent = useMemo(() => {
    if (!modal) return null
    if (modal.kind === 'duplicate') {
      return {
        title: 'Same name already exists',
        message: `"${modal.text}" 이름이 이미 저장되어 있습니다. 중복 출력을 막기 위해 출력하지 않았습니다.`,
        confirmLabel: 'OK',
      }
    }
    if (modal.kind === 'delete-one') {
      return {
        title: 'Delete history item?',
        message: `"${modal.item.text}" 기록을 삭제할까요?`,
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        destructive: true,
      }
    }
    return {
      title: 'Clear all history?',
      message: '저장된 출력 기록을 모두 삭제할까요?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      destructive: true,
    }
  }, [modal])

  async function connect() {
    setIsConnecting(true)
    setErrorMessage('')
    setStatusMessage('')
    try {
      setStatus(await printer.scanAndConnect())
    } catch (error) {
      setErrorMessage(formatError(error))
      setStatus({ connected: false })
    } finally {
      setIsConnecting(false)
    }
  }

  async function disconnect() {
    setIsConnecting(true)
    setErrorMessage('')
    setStatusMessage('')
    try {
      setStatus(await printer.disconnect())
    } catch (error) {
      setErrorMessage(formatError(error))
      setStatus({ connected: false })
    } finally {
      setIsConnecting(false)
    }
  }

  async function scanOnly() {
    setIsScanning(true)
    setErrorMessage('')
    setStatusMessage('')
    setScanResults([])
    try {
      const results = await printer.scanPrinters()
      setScanResults(results)
      if (results.length === 0) {
        setErrorMessage('No BLE peripherals were visible. Check macOS Bluetooth permission and keep D11_H awake near the Mac.')
      }
    } catch (error) {
      setErrorMessage(formatError(error))
    } finally {
      setIsScanning(false)
    }
  }

  async function print() {
    if (!normalizedText || isPrinting) return

    if (hasDuplicateText(history, normalizedText)) {
      setModal({ kind: 'duplicate', text: normalizedText })
      return
    }

    setIsPrinting(true)
    setErrorMessage('')
    setStatusMessage('')
    try {
      const latestStatus = await printer.getStatus()
      setStatus(latestStatus)
      if (!latestStatus.connected) {
        throw new Error('Printer disconnected. Reconnect NIIMBOT D11_H and try again.')
      }

      const bitmap = makeBitmap(normalizedText, labelSize)
      await printer.printLabel(bitmap, clampQuantity(quantity), labelSize)
      const nextHistory = upsertHistory(history, normalizedText, labelSize)
      setHistory(nextHistory)
      saveHistory(nextHistory)
      setText('')
      setQuantity(1)
      focusText()
    } catch (error) {
      setErrorMessage(formatError(error))
      await refreshStatus()
    } finally {
      setIsPrinting(false)
    }
  }

  function recall(item: PrintHistoryItem) {
    setText(item.text)
    setLabelSize(item.labelSize)
    focusText()
  }

  function confirmModal() {
    if (!modal) return
    if (modal.kind === 'delete-all') {
      setHistory([])
      saveHistory([])
    }
    if (modal.kind === 'delete-one') {
      const nextHistory = deleteHistoryItem(history, modal.item)
      setHistory(nextHistory)
      saveHistory(nextHistory)
    }
    setModal(null)
    focusText()
  }

  function closeModal() {
    setModal(null)
    focusText()
  }

  return (
    <MantineProvider theme={theme}>
      <Notifications position="top-center" />
      <Box className="app-shell">
        <Box className="workspace">
          <Paper className="main-panel" shadow="xl">
            <Group justify="space-between" align="flex-start" gap="lg" className="app-header">
              <Stack gap={4}>
                <Text className="eyebrow">NIIMBOT D11_H</Text>
                <Title order={1}>Label Console</Title>
                <Text c="dimmed" size="sm">
                  macOS CoreBluetooth printing utility
                </Text>
              </Stack>

              <Group gap="xs" justify="flex-end" className="connection-actions">
                <Badge
                  color={status.connected ? 'teal' : 'gray'}
                  variant={status.connected ? 'filled' : 'light'}
                  leftSection={status.connected ? <IconCheck size={13} /> : null}
                  className="status-badge"
                >
                  {status.connected ? status.deviceName || 'Connected' : 'Disconnected'}
                </Badge>
                {status.connected ? (
                  <Button
                    variant="light"
                    color="red"
                    leftSection={<IconBluetoothOff size={18} />}
                    loading={isConnecting}
                    onClick={disconnect}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button leftSection={<IconBluetooth size={18} />} loading={isConnecting} onClick={connect}>
                    Connect
                  </Button>
                )}
                <Button variant="default" leftSection={<IconSearch size={18} />} loading={isScanning} onClick={scanOnly}>
                  Scan
                </Button>
              </Group>
            </Group>

            <Box className="console-grid">
              <Stack className="print-card" gap="lg">
                {errorMessage ? (
                  <Alert color="red" variant="light" title="Printer error">
                    {errorMessage}
                  </Alert>
                ) : null}
                {statusMessage ? (
                  <Alert color="yellow" variant="light" title="Status">
                    {statusMessage}
                  </Alert>
                ) : null}

                <TextInput
                  ref={inputRef}
                  label="Text"
                  placeholder="라벨 이름"
                  value={text}
                  onChange={(event) => setText(event.currentTarget.value)}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !isComposing && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      void print()
                    }
                  }}
                  size="xl"
                  className="label-input"
                />

                <Group grow align="flex-start">
                  <Select
                    label="Label size"
                    data={labelOptions}
                    value={labelSize}
                    onChange={(value) => setLabelSize((value as LabelSize) || '12x22')}
                    allowDeselect={false}
                    size="md"
                  />
                  <NumberInput
                    label="Quantity"
                    min={1}
                    max={20}
                    clampBehavior="strict"
                    value={quantity}
                    onChange={setQuantity}
                    size="md"
                  />
                </Group>

                <Button
                  leftSection={<IconPrinter size={19} />}
                  size="lg"
                  loading={isPrinting}
                  disabled={!normalizedText || isPrinting}
                  onClick={print}
                  className="print-button"
                >
                  Print Label
                </Button>

                {scanResults.length > 0 ? (
                  <Paper className="scan-panel" withBorder>
                    <Text fw={600} size="sm">
                      Scan result
                    </Text>
                    <Stack gap={4} mt="xs">
                      {scanResults.map((device, index) => (
                        <Text key={`${device.name}-${index}`} size="xs" c={device.matched ? 'teal' : 'dimmed'}>
                          {device.matched ? 'Matched' : 'Seen'} · {device.name}
                          {device.services.length ? ` · ${device.services.join(', ')}` : ''}
                        </Text>
                      ))}
                    </Stack>
                  </Paper>
                ) : null}
              </Stack>

              <Paper className="preview-card" withBorder>
                <Group justify="space-between" mb="md" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={600}>Preview</Text>
                    <Text size="xs" c="dimmed">
                      {currentSize.name}
                    </Text>
                  </Stack>
                  <Text size="xs" c="dimmed">
                    {currentSize.width} x {currentSize.height}px
                  </Text>
                </Group>
                <Box className="label-paper">
                  <LabelPreview text={text} labelSize={labelSize} />
                </Box>
              </Paper>
            </Box>
          </Paper>

          <Paper className="history-panel" shadow="xl">
            <Group justify="space-between" className="history-head">
              <Stack gap={2}>
                <Title order={2}>History</Title>
                <Text size="xs" c="dimmed">
                  Korean sorted print names
                </Text>
              </Stack>
              <Tooltip label="Clear all history">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label="Clear history"
                  disabled={history.length === 0}
                  onClick={() => setModal({ kind: 'delete-all' })}
                >
                  <IconRefresh size={20} />
                </ActionIcon>
              </Tooltip>
            </Group>

            <ScrollArea className="history-list">
              {history.length === 0 ? (
                <Paper className="empty-history" withBorder>
                  <Text size="sm" c="dimmed">
                    출력 기록이 아직 없습니다.
                  </Text>
                </Paper>
              ) : (
                <Stack gap="xs">
                  {history.map((item) => (
                    <Paper
                      key={`${item.text}-${item.labelSize}-${item.printedAt}`}
                      className="history-item"
                      withBorder
                      role="button"
                      tabIndex={0}
                      onClick={() => recall(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          recall(item)
                        }
                      }}
                    >
                      <Box>
                        <Text fw={600}>{item.text}</Text>
                        <Text size="sm" c="dimmed">
                          {LABEL_SIZES[item.labelSize].name} · {new Date(item.printedAt).toLocaleString('ko-KR')}
                        </Text>
                      </Box>
                      <Tooltip label="Delete">
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          aria-label={`Delete ${item.text}`}
                          onClick={(event) => {
                            event.stopPropagation()
                            setModal({ kind: 'delete-one', item })
                          }}
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Paper>
                  ))}
                </Stack>
              )}
            </ScrollArea>
          </Paper>
        </Box>
      </Box>

      {modalContent ? (
        <ConfirmModal
          opened={Boolean(modal)}
          title={modalContent.title}
          message={modalContent.message}
          confirmLabel={modalContent.confirmLabel}
          cancelLabel={modalContent.cancelLabel}
          destructive={modalContent.destructive}
          onCancel={closeModal}
          onConfirm={confirmModal}
        />
      ) : null}
    </MantineProvider>
  )
}

function clampQuantity(value: number | string) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10)
  return Math.min(20, Math.max(1, Math.trunc(Number.isFinite(parsed) ? parsed : 1)))
}

function formatError(error: unknown) {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return 'Unexpected printer error'
}
