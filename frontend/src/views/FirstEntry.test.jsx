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
    expect(mocks.S.profile.goal).toBe('recomp')
    expect(mocks.S.profile.split).toBe('ppl')
    expect(mocks.S.gyms).toHaveLength(1)
    expect(mocks.S.gyms[0].name).toBe('Planet Fitness')
    expect(mocks.S.activeGymId).toBe(mocks.S.gyms[0].id)
    expect(mocks.S.equipFilterOn).toBe(true)   // the gym is live as the hard filter
    expect(nav).toHaveBeenCalledWith('/workout', { replace: true })
  })
})
