// @vitest-environment happy-dom
// Nutrition home (nutrition-spec.md §3.4, §5, §6): the protein bar counts toward the
// target, the verified/estimate split is always on screen, estimates carry their stamp,
// and an empty day is a plain statement. The quick-add sheet is exercised end to end:
// an estimate logged there is born with src 'estimate' in the store.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NutritionHome from './NutritionHome.jsx'
import { todayISO } from '../lib/format.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null, sheets: [] }
  state.snapshot = () => ({
    S: state.S,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
    toast: vi.fn(),
    openSheet: render => { state.sheets.push(render); return { close: vi.fn() } },
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useUI.getState = mocks.snapshot
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {}, useLocation: () => ({ state: null }) }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: vi.fn() }))

const mounted = []
function render(node) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(node))
  return host
}
const btn = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const setInput = (input, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})

const entry = (over = {}) => ({
  id: 'e' + Math.random().toString(36).slice(2, 8), foodId: null, name: 'Food', servings: 1,
  perServing: { calories: 200, proteinG: 20, carbsG: 10, fatG: 5, saturatedFatG: null, fiberG: null, sugarsG: null, addedSugarsG: null, sodiumMg: 100, cholesterolMg: null },
  src: 'manual', note: '', d: todayISO(), t: Date.now(), ...over,
})

beforeEach(() => {
  mocks.S = { foods: [], foodLog: [], nutritionTargets: { proteinG: 180, calories: null } }
  mocks.sheets = []
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(r => r.unmount()) }) })

describe('Nutrition home', () => {
  it('shows the protein bar, the remaining grams and the verified/estimate split', () => {
    mocks.S.foodLog = [
      entry({ name: 'Powder', src: 'label', perServing: { calories: 130, proteinG: 40, carbsG: 3, fatG: 1, saturatedFatG: null, fiberG: null, sugarsG: null, addedSugarsG: null, sodiumMg: 130, cholesterolMg: null } }),
      entry({ name: 'Burrito', src: 'estimate', perServing: { calories: 700, proteinG: 20, carbsG: 60, fatG: 25, saturatedFatG: null, fiberG: null, sugarsG: null, addedSugarsG: null, sodiumMg: null, cholesterolMg: null } }),
    ]
    const host = render(<NutritionHome />)
    expect(host.querySelector('.nutri-big').textContent).toBe('60')
    expect(host.textContent).toContain('120 g left')
    expect(host.textContent).toContain('40 verified')
    expect(host.textContent).toContain('20 est.')
    // sodium was missing on one entry: partial, named, not silently zero-filled into a claim
    expect(host.textContent).toContain('missing sodium')
    const stamps = [...host.querySelectorAll('.stamp')].map(s => s.textContent)
    expect(stamps).toContain('Verified label')
    expect(stamps).toContain('Estimate')
    // no calorie target anywhere: it was never set
    expect(host.textContent).not.toContain('kcal left')
  })

  it('an empty day says so, plainly', () => {
    const host = render(<NutritionHome />)
    expect(host.textContent).toContain('Nothing logged yet')
    expect(host.querySelector('.nutri-big').textContent).toBe('0')
  })

  it('the Estimate sheet logs an entry born with src estimate', () => {
    const host = render(<NutritionHome />)
    act(() => btn(host, 'Estimate').click())
    expect(mocks.sheets).toHaveLength(1)
    const sheetHost = render(mocks.sheets[0](() => {}))
    const inputs = [...sheetHost.querySelectorAll('input')]
    setInput(inputs[0], 'Gas station burrito')          // name
    setInput(inputs[2], '32')                            // protein (after calories)
    act(() => btn(sheetHost, 'Log it').click())
    expect(mocks.S.foodLog).toHaveLength(1)
    expect(mocks.S.foodLog[0]).toMatchObject({ name: 'Gas station burrito', src: 'estimate' })
    expect(mocks.S.foodLog[0].perServing.proteinG).toBe(32)
  })
})
