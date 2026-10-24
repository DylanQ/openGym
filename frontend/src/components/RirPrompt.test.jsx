// @vitest-environment happy-dom
// The per-exercise effort prompt (fitbod-experience.md B5.2): it appears only when the
// exercise is actually finished, and one tap is the whole interaction.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RirPrompt, { exerciseFinished } from './RirPrompt.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const work = (done, extra = {}) => ({ w: 50, r: 10, done, ...extra })
const entry = sets => ({ id: '0576', sets, target: { sets: 3, reps: 10, weight: 50 } })

describe('exerciseFinished', () => {
  it('needs every work set done; warm-ups neither count nor block', () => {
    expect(exerciseFinished(entry([work(true), work(true)]))).toBe(true)
    expect(exerciseFinished(entry([work(true), work(false)]))).toBe(false)
    expect(exerciseFinished(entry([{ w: 25, r: 8, done: false, warmup: true, phase: 'warmup' }, work(true)]))).toBe(true)
    expect(exerciseFinished(entry([]))).toBe(false)
  })
})

describe('RirPrompt', () => {
  let host, root
  afterEach(() => { act(() => root.unmount()); host.remove() })
  const render = node => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(node))
  }

  it('stays silent until the last work set is done', () => {
    render(<RirPrompt entry={entry([work(true), work(false)])} onRate={vi.fn()} />)
    expect(host.textContent).toBe('')
  })

  it('asks once, and one tap rates it — 4+ included', () => {
    const onRate = vi.fn()
    render(<RirPrompt entry={entry([work(true), work(true)])} onRate={onRate} />)
    expect(host.textContent).toContain('How many reps were left?')
    const chips = [...host.querySelectorAll('.rirprompt-chips .chip')]
    expect(chips.map(c => c.textContent)).toEqual(['0', '1', '2', '3', '4+'])
    act(() => chips[4].click())
    expect(onRate).toHaveBeenCalledWith(4)
  })

  it('shows the recorded answer as the pressed chip', () => {
    render(<RirPrompt entry={entry([work(true), { ...work(true), rir: 2 }])} onRate={vi.fn()} />)
    const e = { ...entry([work(true), work(true)]), rirPrompt: 2 }
    render(<RirPrompt entry={e} onRate={vi.fn()} />)
    const chips = [...host.querySelectorAll('.rirprompt-chips .chip')]
    expect(chips[2].getAttribute('aria-pressed')).toBe('true')
    expect(host.textContent).toContain('Reps left')
  })
})
