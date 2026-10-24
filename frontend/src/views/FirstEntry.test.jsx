// @vitest-environment happy-dom
// The First Entry (fitbod-experience.md B2): the walk writes nothing until the last
// step, then lands the whole profile at once — goal, gym, onboarded — and the
// calibration answers become confirmed weights.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FirstEntry from './FirstEntry.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const nav = vi.fn()
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
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))

let host, root
beforeEach(() => {
  nav.mockClear()
  mocks.S = {
    unit: 'lb', workouts: [], routines: [], customEx: [], favEx: [], exWeights: {},
    equipProfiles: [], dumbbells: {}, bodyweight: [], profile: null, onboarded: false,
    gyms: [], activeGymId: null, exPref: {}, swapStats: {}, recoveryOverride: {},
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text || b.textContent.includes(text))
const walkToEnd = () => { for (let i = 0; i < 7; i++) act(() => button('Continue').click()) }

describe('First Entry', () => {
  it('opens on the goal, with recomp first and pre-picked', () => {
    act(() => root.render(<FirstEntry />))
    expect(host.textContent).toContain('What are we training for?')
    const recomp = button('Recomp')
    expect(recomp).toBeTruthy()
    expect(recomp.className).toContain('on')
    expect(mocks.S.profile).toBeNull()   // nothing is written mid-walk
  })

  it('finishing lands the profile, the gym and the onboarded flag at once', () => {
    act(() => root.render(<FirstEntry />))
    walkToEnd()
    expect(host.textContent).toContain('Calibrate the machine')
    act(() => button('Compose my first workout').click())
    expect(mocks.S.onboarded).toBe(true)
    expect(mocks.S.introSeen).toBe(true)
    expect(mocks.S.profile.goal).toBe('recomp')
    expect(mocks.S.profile.split).toBe('ppl')
    expect(mocks.S.gyms).toHaveLength(1)
    expect(mocks.S.gyms[0].name).toBe('Planet Fitness')
    expect(mocks.S.activeGymId).toBe(mocks.S.gyms[0].id)
    expect(mocks.S.equipFilterOn).toBe(true)   // the gym is live as the hard filter
    expect(nav).toHaveBeenCalledWith('/workout', { replace: true })
  })

  it('prefills from a saved profile and the last weigh-in, and writes body weight in the state unit', () => {
    mocks.S.profile = { goal: 'get-stronger', experience: 'advanced', split: 'upper-lower', daysPerWeek: 4, durationMin: 45, warmupSets: false, supersets: true, cardio: 'end' }
    mocks.S.bodyweight = [{ d: '2026-10-22', w: 224 }]
    act(() => root.render(<FirstEntry />))
    expect(button('Get Stronger').className).toContain('on')
    // Walk to the body step and confirm the weigh-in carried over in lb, not converted.
    for (let i = 0; i < 6; i++) act(() => button('Continue').click())
    expect(host.textContent).toContain('The body, briefly')
    const bwInput = host.querySelector('input[aria-label="Body weight"]')
    expect(bwInput.value).toBe('224')
    act(() => button('Continue').click())
    act(() => button('Compose my first workout').click())
    expect(mocks.S.bodyweight.at(-1).w).toBe(224)   // state's unit (lb) — never converted to kg
    expect(mocks.S.profile.goal).toBe('get-stronger')
    expect(mocks.S.introSeen).toBe(true)
  })

  it('skipping retires the intro without writing anything', () => {
    act(() => root.render(<FirstEntry />))
    act(() => button('Skip setup').click())
    expect(mocks.S.introSeen).toBe(true)
    expect(mocks.S.profile).toBeNull()
    expect(nav).toHaveBeenCalledWith('/workout', { replace: true })
  })
})
