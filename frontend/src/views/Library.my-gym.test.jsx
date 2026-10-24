// @vitest-environment happy-dom
// My Gym (this fork, lib/my-gym.js): the Library's scope chip narrows the catalogue to the
// seeded rotation + favourites + recents, and the setup card files the seed into the
// profile — favourites, working weights, notes, starter routines — in one tap.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Library from './Library.jsx'
import { MY_GYM_IDS } from '../lib/my-gym.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({ S: state.S, user: null, update: mut => { const next = structuredClone(state.S); mut(next); state.S = next } })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../sheets.jsx', () => ({ exerciseDetailSheet: vi.fn(), addToRoutineSheet: vi.fn(), customExSheet: vi.fn() }))

const mounted = []
function render() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(<Library />))
  return host
}
const chip = (host, text) => [...host.querySelectorAll('.chip')].find(b => b.textContent === text)
const names = host => [...host.querySelectorAll('.item .tt')].map(el => el.textContent).slice(1)   // drop "Create your own"

beforeEach(() => {
  mocks.S = { unit: 'lb', lang: 'en', routines: [], workouts: [], customEx: [], exWeights: {}, exNotes: {}, favEx: [], equipProfiles: [], activeEquipId: null, equipFilterOn: false }
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('Library My Gym', () => {
  it('scopes the list to the seeded rotation, in seed order, with knee stamps', () => {
    const host = render()
    expect(names(host).length).toBeGreaterThan(8)
    act(() => chip(host, 'My Gym').click())
    expect(names(host)).toEqual([
      'Machine Chest Press', 'Machine Pec Deck Fly', 'Dumbbell Lateral Raise', 'Cable Pushdown',
      'Machine Seated Leg Press', 'Machine Seated Leg Curl', 'Dumbbell Romanian Deadlift', 'Dumbbell Standing Calf Raise',
    ])
    const rows = [...host.querySelectorAll('.item')].slice(1)
    const legPress = rows.find(r => r.textContent.includes('Machine Seated Leg Press'))
    expect(legPress.querySelector('.stamp-caution')).not.toBeNull()
    const legCurl = rows.find(r => r.textContent.includes('Machine Seated Leg Curl'))
    expect(legCurl.querySelector('.stamp-safe')).not.toBeNull()
  })

  it('offers the one-tap setup until the seed is filed, then shows seeded weights', () => {
    const host = render()
    act(() => chip(host, 'My Gym').click())
    const setupBtn = [...host.querySelectorAll('button')].find(b => b.textContent === 'Set up My Gym')
    expect(setupBtn, 'setup card button').toBeTruthy()
    act(() => setupBtn.click())
    // The seed landed in the profile's own fields.
    expect(mocks.S.favEx).toEqual(MY_GYM_IDS)
    expect(mocks.S.exWeights['0201']).toEqual({ w: 80, d: '2026-10-23' })
    expect(mocks.S.exNotes['2267']).toContain('build up gradually')
    expect(mocks.S.routines.map(r => r.name)).toEqual(['Push Day', 'Leg Day'])
    // Re-rendered, the card is gone and the pushdown row carries its seeded weight.
    const host2 = render()
    act(() => chip(host2, 'My Gym').click())
    expect([...host2.querySelectorAll('button')].some(b => b.textContent === 'Set up My Gym')).toBe(false)
    const pushdown = [...host2.querySelectorAll('.item')].find(r => r.textContent.includes('Cable Pushdown'))
    expect(pushdown.querySelector('.tag.seed')?.textContent).toBe('80')
  })
})
