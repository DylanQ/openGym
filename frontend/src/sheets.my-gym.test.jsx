// @vitest-environment happy-dom
// My Gym in the exercise picker (this fork, lib/my-gym.js): one more scope chip beside
// Favourites and Chosen, listing the seeded rotation + favourites + recents — and the knee
// flags ride on the rows without ever blocking a pick.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exercisePicker } from './sheets.jsx'
import { MY_GYM_IDS } from './lib/my-gym.js'

const mounted = []
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const names = host => [...host.querySelectorAll('.item .tt')].map(el => el.textContent)

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('exercise picker My Gym scope', () => {
  it('lists exactly the My Gym scope and stamps the knee flags', () => {
    exercisePicker(vi.fn())
    const host = renderTop()
    const chipBtn = [...host.querySelectorAll('.chip')].find(b => b.textContent.startsWith('My Gym'))
    expect(chipBtn, 'My Gym chip').toBeTruthy()
    expect(chipBtn.textContent).toContain(String(MY_GYM_IDS.length))
    act(() => chipBtn.click())
    const shown = names(host)
    expect(new Set(shown)).toEqual(new Set([
      'Machine Chest Press', 'Machine Pec Deck Fly', 'Dumbbell Lateral Raise', 'Cable Pushdown',
      'Machine Seated Leg Press', 'Machine Seated Leg Curl', 'Dumbbell Romanian Deadlift', 'Dumbbell Standing Calf Raise',
    ]))
    // No "Create your own" row inside a scope, and the leg press carries its caution stamp.
    expect(shown.some(n => n.includes('Create your own'))).toBe(false)
    const legPress = [...host.querySelectorAll('.item')].find(r => r.textContent.includes('Machine Seated Leg Press'))
    expect(legPress.querySelector('.stamp-caution')).not.toBeNull()
  })

  it('still picks an exercise from the scope', () => {
    const onPick = vi.fn()
    exercisePicker(onPick)
    const host = renderTop()
    act(() => [...host.querySelectorAll('.chip')].find(b => b.textContent.startsWith('My Gym')).click())
    const row = [...host.querySelectorAll('.item')].find(r => r.textContent.includes('Cable Pushdown'))
    act(() => row.click())
    expect(onPick).toHaveBeenCalled()
    expect(onPick.mock.calls[0][0].id).toBe('0201')
  })
})
