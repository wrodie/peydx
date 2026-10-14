import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAutosaveQueue, type AutosaveOp } from '../../../components/program-edit/autosaveQueue'

type Deferred = {
  resolve: () => void
  reject: (err?: unknown) => void
  promise: Promise<void>
  sent: any
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function parts(path: string): Array<string | number> {
  return path.split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p))
}

function getPath(obj: any, path: string): any {
  let cur = obj
  for (const p of parts(path)) cur = cur?.[p]
  return cur
}

function setPath(obj: any, path: string, value: any): void {
  const ps = parts(path)
  let cur = obj
  for (let i = 0; i < ps.length - 1; i++) cur = cur[ps[i]]
  cur[ps[ps.length - 1]] = value
}

function imageSlide(tag: string) {
  return { blockType: 'imageBlock', tag, advanceMode: 'manual', duration: 5 }
}

function makeHarness(options: { canSave?: () => boolean } = {}) {
  const state: any = { title: 'Program', slides: [] as any[] }
  const deferreds: Deferred[] = []
  const sentSnapshots: any[] = []
  let submitCount = 0

  const submit = () => {
    submitCount++
    const sent = clone(state)
    sentSnapshots.push(sent)
    const deferred = {
      resolve: () => {},
      reject: (_err?: unknown) => {},
      promise: Promise.resolve() as Promise<void>,
      sent,
    } as Deferred
    deferred.promise = new Promise<void>((resolve, reject) => {
      deferred.resolve = () => {
        // simulate Payload's authoritative server merge on success
        state.slides = clone(sent.slides)
        resolve()
      }
      deferred.reject = (err) => reject(err)
    })
    deferreds.push(deferred)
    return deferred.promise
  }

  const applyOp = (op: AutosaveOp) => {
    switch (op.kind) {
      case 'update':
        setPath(state, op.path, op.value)
        break
      case 'addRow': {
        const arr = getPath(state, op.path)
        const row = { ...(op.subFieldState as any), blockType: op.blockType }
        if (op.rowIndex == null) arr.push(row)
        else arr.splice(op.rowIndex, 0, row)
        break
      }
      case 'removeRow': {
        getPath(state, op.path).splice(op.rowIndex, 1)
        break
      }
      case 'moveRow': {
        const arr = getPath(state, op.path)
        const [item] = arr.splice(op.moveFromIndex, 1)
        arr.splice(op.moveToIndex, 0, item)
        break
      }
      case 'replaceRow': {
        const arr = getPath(state, op.path)
        arr[op.rowIndex] = { ...(op.subFieldState as any), blockType: arr[op.rowIndex]?.blockType }
        break
      }
    }
  }

  const queue = createAutosaveQueue({
    submit,
    applyOp,
    canSave: options.canSave ?? (() => true),
    debounceMs: 400,
  })

  // simulate a user edit: dispatch to local state (as the component does) + record
  const edit = (op: AutosaveOp) => {
    applyOp(op)
    queue.record(op)
  }

  return {
    state,
    queue,
    edit,
    deferreds,
    sentSnapshots,
    get submitCount() {
      return submitCount
    },
  }
}

describe('autosaveQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('replays updates recorded while a submit is in flight (reported bug)', async () => {
    const h = makeHarness()
    h.state.slides = [imageSlide('A'), imageSlide('B'), imageSlide('C'), imageSlide('D'), imageSlide('E')]

    // first edit while idle → captured by the upcoming payload (not recorded)
    h.edit({ kind: 'update', path: 'slides.0.advanceMode', value: 'timed' })
    h.queue.schedule()
    await vi.advanceTimersByTimeAsync(400)
    expect(h.submitCount).toBe(1)

    // edits during the in-flight submit
    for (let i = 1; i < 5; i++) {
      h.edit({ kind: 'update', path: `slides.${i}.advanceMode`, value: 'timed' })
    }

    // submit #1 resolves; merge clobbers local state, then replay restores intent
    h.deferreds[0].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.state.slides.map((s: any) => s.advanceMode)).toEqual([
      'timed', 'timed', 'timed', 'timed', 'timed',
    ])

    // follow-up save persists the full state
    await vi.advanceTimersByTimeAsync(400)
    expect(h.submitCount).toBe(2)
    expect(h.sentSnapshots[1].slides.map((s: any) => s.advanceMode)).toEqual([
      'timed', 'timed', 'timed', 'timed', 'timed',
    ])

    h.deferreds[1].resolve()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(h.submitCount).toBe(2)
  })

  it('replays row add/remove/move/replace recorded while in flight, in order', async () => {
    const h = makeHarness()
    h.state.slides = [imageSlide('A'), imageSlide('B'), imageSlide('C')]

    h.queue.schedule()
    await vi.advanceTimersByTimeAsync(400)
    expect(h.submitCount).toBe(1)

    h.edit({
      kind: 'addRow',
      path: 'slides',
      blockType: 'imageBlock',
      schemaPath: 'slides.imageBlock',
      subFieldState: { tag: 'E' },
    })
    h.edit({ kind: 'removeRow', path: 'slides', rowIndex: 0 })
    h.edit({ kind: 'moveRow', path: 'slides', moveFromIndex: 0, moveToIndex: 2 })
    h.edit({
      kind: 'replaceRow',
      path: 'slides',
      rowIndex: 1,
      schemaPath: 'slides.imageBlock',
      subFieldState: { tag: 'Z' },
    })

    h.deferreds[0].resolve()
    await vi.advanceTimersByTimeAsync(0)

    expect(h.state.slides.map((s: any) => s.tag)).toEqual(['C', 'Z', 'B'])
  })

  it('does not record or replay pre-flight edits, and does not resubmit needlessly', async () => {
    const h = makeHarness()
    h.state.slides = [imageSlide('A')]

    // edit before any submit → recorded is a no-op
    h.edit({ kind: 'update', path: 'slides.0.tag', value: 'A2' })
    h.queue.schedule()
    await vi.advanceTimersByTimeAsync(400)
    expect(h.submitCount).toBe(1)

    h.deferreds[0].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.state.slides[0].tag).toBe('A2')

    // nothing pending, no recorded ops → no redundant save
    await vi.advanceTimersByTimeAsync(1000)
    expect(h.submitCount).toBe(1)
  })

  it('preserves edits and retries when submit rejects', async () => {
    const h = makeHarness()
    h.state.slides = [imageSlide('A'), imageSlide('B')]

    h.queue.schedule()
    await vi.advanceTimersByTimeAsync(400)
    expect(h.submitCount).toBe(1)

    h.edit({ kind: 'update', path: 'slides.0.tag', value: 'X' })

    h.deferreds[0].reject(new Error('network'))
    await vi.advanceTimersByTimeAsync(0)
    // no merge on error; replayed op is harmless and local intent survives
    expect(h.state.slides[0].tag).toBe('X')

    // retry scheduled
    await vi.advanceTimersByTimeAsync(400)
    expect(h.submitCount).toBe(2)
    expect(h.sentSnapshots[1].slides[0].tag).toBe('X')

    h.deferreds[1].resolve()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(h.submitCount).toBe(2)
  })

  it('coalesces rapid schedules and triggers exactly one follow-up for changes during flight', async () => {
    const h = makeHarness()
    h.state.slides = [imageSlide('A')]

    h.queue.schedule()
    h.queue.schedule()
    h.queue.schedule()
    await vi.advanceTimersByTimeAsync(399)
    expect(h.submitCount).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(h.submitCount).toBe(1)

    // change during flight (dispatch + record + passive schedule)
    h.edit({ kind: 'update', path: 'slides.0.tag', value: 'A2' })
    h.queue.schedule()

    h.deferreds[0].resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(h.state.slides[0].tag).toBe('A2')

    await vi.advanceTimersByTimeAsync(400)
    expect(h.submitCount).toBe(2)

    h.deferreds[1].resolve()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(h.submitCount).toBe(2)
  })

  it('never submits when canSave returns false', async () => {
    const h = makeHarness({ canSave: () => false })
    h.queue.schedule()
    await vi.advanceTimersByTimeAsync(5000)
    expect(h.submitCount).toBe(0)
  })
})
