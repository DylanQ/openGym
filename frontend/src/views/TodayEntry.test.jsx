// @vitest-environment happy-dom
// Today's Entry (fitbod-experience.md B6): arriving at the start screen composes the
// day from the profile, the gym and the log — and the composition lands in the store
// as a plan the Start button can hand to a session. Regenerating shelves the old plan
// behind Undo.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TodayEntry from './TodayEntry.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({
    S: state.S,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
    toast: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => (selector ? selector(mocks.snapshot()) : mocks.snapshot())
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = selector => (selector ? selector(mocks.snapshot()) : mocks.snapshot())
  useUI.getState = mocks.snapshot
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({ menuSheet: vi.fn(), exercisePicker: vi.fn(), startTodayPlan: vi.fn() }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => <div className="thumb" /> }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => <div className="bodymap" /> }))

const dylan = () => ({
  unit: 'lb', workouts: [], routines: [], customEx: [], favEx: [],
  exWeights: {
    '0576': { w: 65, d: '2026-10-23' }, '1030': { w: 55, d: '2026-10-23' },
    '0334': { w: 15, d: '2026-10-23' }, '0201': { w: 80, d: '2026-10-23' },
    '2267': { w: 65, d: '2026-10-23' }, '0599': { w: 60, d: '2026-10-23' },
    '1459': { w: 20, d: '2026-10-23' },
  },
  exNotes: {}, equipProfiles: [], activeEquipId: null, equipFilterOn: false, dumbbells: {},
  bodyweight: [], profile: null, onboarded: true, gyms: [], activeGymId: null,
  exPref: {}, swapStats: {}, recoveryOverride: {}, weekStart: 1,
  todayPlan: null, todayPlanPrev: null, active: null,
})

let host, root
beforeEach(() => {
  mocks.S = dylan()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

// The mock store is not reactive: a store write in an effect or a handler is followed
// by an explicit re-render, the way zustand's subscription re-renders the real app.
const render = () => { act(() => root.render(<TodayEntry />)); act(() => root.render(<TodayEntry />)) }
const rerender = () => act(() => root.render(<TodayEntry />))
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.includes(text))

describe("Today's Entry", () => {
  it('composes the day on arrival and stores the plan', () => {
    render()
    const plan = mocks.S.todayPlan
    expect(plan).toBeTruthy()
    expect(plan.dayKey).toBe('push')
    expect(plan.entries.length).toBeGreaterThanOrEqual(3)
    expect(host.textContent).toContain('TODAY’S ENTRY')
    expect(host.textContent).toContain('Push Day')
    expect(host.textContent).toContain('Start workout')
    // every card carries its reason
    expect(host.querySelectorAll('.today-why').length).toBe(plan.entries.length)
  })

  it('regenerating shelves the previous composition behind Undo, and Undo restores it', () => {
    render()
    const first = mocks.S.todayPlan
    act(() => button('Regenerate').click())
    expect(mocks.S.todayPlanPrev?.composedAt).toBe(first.composedAt)
    rerender()
    expect(button('Undo')).toBeTruthy()
    act(() => button('Undo').click())
    expect(mocks.S.todayPlan.composedAt).toBe(first.composedAt)
    expect(mocks.S.todayPlanPrev).toBeNull()
  })

  it('removing a card rewrites the plan in the store', () => {
    render()
    const n = mocks.S.todayPlan.entries.length
    const removeBtn = host.querySelector('.today-card [aria-label="Remove"]')
    act(() => removeBtn.click())
    expect(mocks.S.todayPlan.entries.length).toBe(n - 1)
  })
})
