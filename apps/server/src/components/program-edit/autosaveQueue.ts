export type AutosaveOp =
  | { kind: 'update'; path: string; value: unknown }
  | {
      kind: 'addRow'
      path: string
      rowIndex?: number
      blockType?: string
      schemaPath?: string
      subFieldState?: Record<string, unknown>
    }
  | { kind: 'removeRow'; path: string; rowIndex: number }
  | { kind: 'moveRow'; path: string; moveFromIndex: number; moveToIndex: number }
  | {
      kind: 'replaceRow'
      path: string
      rowIndex: number
      schemaPath?: string
      subFieldState?: Record<string, unknown>
    }

export type AutosaveQueueArgs = {
  submit: () => Promise<unknown>
  applyOp: (op: AutosaveOp) => void
  canSave: () => boolean
  debounceMs?: number
}

export type AutosaveQueue = {
  schedule: () => void
  record: (op: AutosaveOp) => void
}

export function createAutosaveQueue(args: AutosaveQueueArgs): AutosaveQueue {
  const debounceMs = args.debounceMs ?? 400
  let inFlight = false
  let pending = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const recorded: AutosaveOp[] = []

  async function run(): Promise<void> {
    inFlight = true
    try {
      await args.submit()
    } catch {
      // keep local edits; retried below
    } finally {
      const ops = recorded.splice(0, recorded.length)
      const wasPending = pending
      pending = false
      inFlight = false
      for (const op of ops) args.applyOp(op)
      if (ops.length > 0 || wasPending) schedule()
    }
  }

  function schedule(): void {
    if (!args.canSave()) return
    if (inFlight) {
      pending = true
      return
    }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void run()
    }, debounceMs)
  }

  function record(op: AutosaveOp): void {
    if (inFlight) recorded.push(op)
  }

  return { schedule, record }
}
