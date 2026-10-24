// @vitest-environment happy-dom
// UX overhaul (Oct 2026): the today row and the tab Start button land on the Start
// screen, where Today's Entry is the default — they no longer jump straight into
// today's planned session. The old "Choose a different workout" door existed only
// because both used to bypass the Start screen, so it is gone with them.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import { startFlow, dayOverrideSheet } from '../sheets.jsx'
import Home from './Home.jsx'

const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(),
}))

const routines = [{ id: 'r1', name: 'Push', emoji: null, ex: [{ id: '0025' }] }]

let host, root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  nav.mockClear(); startFlow.mockClear(); dayOverrideSheet.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

// Every weekday points at a routine and the weigh-in is off: today is always planned.
const setS = (over = {}) => useStore.setState(s => ({
  S: {
    ...s.S, routines, dayPlan: {}, workouts: [], active: null, weighIn: false,
    week: { 0: ['r1'], 1: ['r1'], 2: ['r1'], 3: ['r1'], 4: ['r1'], 5: ['r1'], 6: ['r1'] }, ...over,
  },
  user: null,
}))
const mount = () => act(() => root.render(<Home />))
const todayRow = () => host.querySelector('.today-row')

describe('Home — the today row goes to the Start screen', () => {
  it('has no separate door any more: the row itself is the way in', () => {
    setS(); mount()
    expect([...host.querySelectorAll('button')].find(b => b.textContent.includes('Choose a different workout'))).toBeUndefined()
  })

  it('opens the Start screen without starting anything', () => {
    setS(); mount()
    act(() => { todayRow().dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(nav).toHaveBeenCalledWith('/workout')
    expect(startFlow).not.toHaveBeenCalled()
  })

  it('on a rest day, still opens the day-override sheet instead', () => {
    setS({ week: {} }); mount()
    act(() => { todayRow().dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(dayOverrideSheet).toHaveBeenCalled()
    expect(nav).not.toHaveBeenCalledWith('/workout')
  })
})
