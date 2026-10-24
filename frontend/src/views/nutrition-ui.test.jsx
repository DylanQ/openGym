// @vitest-environment happy-dom
// Field report from the label confirm screen: the boxes rendered WHITE and their contents
// were invisible until tapped. A bare NumberField is an unstyled <input>, and with no
// color-scheme declared anywhere the WebView paints it with the light UA background —
// while the global input reset colours the text var(--label), near-white in the dark
// theme. Tapping seemed to fix it because NumberField selects all on focus and the
// selection highlight sits behind the text. These tests pin the contract that makes the
// fields readable unfocused: every nutrition input is a themed field — var(--label) text
// on var(--surface) — in the dark, light and Ledger themes alike, since the themes only
// re-point those two tokens. happy-dom applies no cascade, so the class hooks are
// asserted in the DOM and the token bindings in index.css itself.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PerServingForm, ServingsStepper, blankFoodDraft } from './nutrition-ui.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mounted = []
function render(node) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(node))
  return host
}
afterEach(() => {
  while (mounted.length) { const [root, host] = mounted.pop(); act(() => root.unmount()); host.remove() }
})

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const rule = sel => css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}'))?.[1] || ''

describe('the confirm form fields', () => {
  it('puts every input on the themed field styling — no bare inputs', () => {
    const draft = blankFoodDraft('label')
    draft.name = 'Whey'
    draft.perServing.calories = 130
    const host = render(<PerServingForm value={draft} onChange={() => {}} />)
    const inputs = [...host.querySelectorAll('input')]
    expect(inputs.length).toBeGreaterThan(10)
    for (const input of inputs) {
      expect(input.classList.contains('field') || input.classList.contains('input'),
        input.outerHTML.slice(0, 80)).toBe(true)
    }
  })

  it('keeps the amber check outline reaching the number inputs', () => {
    const host = render(<PerServingForm value={blankFoodDraft('label')} onChange={() => {}} confidence={{ calories: 'check' }} />)
    const checked = host.querySelector('.nutri-field.check input')
    expect(checked).not.toBeNull()
    expect(checked.classList.contains('input')).toBe(true)
  })
})

describe('the servings stepper box', () => {
  it('is a themed field, not a bare input', () => {
    const host = render(<ServingsStepper servings={1} onChange={() => {}} />)
    expect(host.querySelector('input.nutri-servings')).not.toBeNull()
    const r = rule('.nutri-servings')
    expect(r).toContain('background:var(--surface)')
    expect(r).toContain('color:var(--label)')
  })
})

describe('the field contrast contract', () => {
  it('paints fields with the surface token, and input text with the label token', () => {
    expect(rule('.field,.input')).toContain('background:var(--surface)')
    expect(css).toContain('input,select,textarea{font:inherit;color:var(--label);letter-spacing:inherit}')
  })

  // The views this test file cannot render cheaply (store- and sheet-bound) get the same
  // guarantee at the source: a NumberField without className "input" is the white box.
  it('leaves no bare NumberField in the Nutrition views', () => {
    for (const f of ['NutritionHome.jsx', 'NutritionSettings.jsx', 'nutrition-ui.jsx']) {
      const src = readFileSync(resolve(process.cwd(), 'src/views/' + f), 'utf8')
      const tags = src.match(/<NumberField[\s\S]*?\/>/g) || []
      expect(tags.length, f).toBeGreaterThan(0)
      for (const tag of tags) expect(tag, f + ': ' + tag.slice(0, 60)).toContain('className="input"')
    }
  })
})
