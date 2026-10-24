// @vitest-environment happy-dom
// Local-only (Oct 2026): /api/config is a server route, and there is no server
// any more — so without a user the config calls answer null and fetch nothing.
// The fetch-and-cache contract below is pinned only for a user held in state
// (the method still exists for the follow-up deletion pass; no UI sets a user).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))

import { api } from '../lib/api.js'
import { useStore } from './useStore.js'

beforeEach(() => { api.mockReset(); useStore.setState({ config: null, user: null }) })
afterEach(() => { useStore.setState({ config: null, user: null }) })

describe('server config, local-only', () => {
  it('without a user, loadConfig answers null and fetches nothing', async () => {
    expect(await useStore.getState().loadConfig()).toBeNull()
    expect(useStore.getState().config).toBeNull()
    expect(api).not.toHaveBeenCalled()
  })

  it('without a user, refreshConfig answers null and fetches nothing, however often called', async () => {
    expect(await useStore.getState().refreshConfig()).toBeNull()
    expect(await useStore.getState().refreshConfig()).toBeNull()
    expect(api).not.toHaveBeenCalled()
  })

  it('with a user in state, loadConfig fetches once and then answers from the cache', async () => {
    useStore.setState({ user: { id: 'u1', name: 'A' } })
    api.mockResolvedValue({ invite_only: true, allow_guest: false, coach: { enabled: true } })
    expect(await useStore.getState().loadConfig()).toEqual({ invite_only: true, allow_guest: false, coach: { enabled: true } })
    expect(await useStore.getState().loadConfig()).toMatchObject({ coach: { enabled: true } })
    expect(api).toHaveBeenCalledTimes(1)
    expect(api).toHaveBeenCalledWith('/api/config')
  })

  it('with a user in state, refreshConfig always asks, and two callers at once make one request', async () => {
    useStore.setState({ user: { id: 'u1', name: 'A' } })
    api.mockResolvedValue({ invite_only: false, allow_guest: true, coach: null })
    const [a, b] = await Promise.all([useStore.getState().refreshConfig(), useStore.getState().refreshConfig()])
    expect(api).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)

    // Not a cache, though: the next caller gets a fresh answer.
    await useStore.getState().refreshConfig()
    expect(api).toHaveBeenCalledTimes(2)
  })

  it('with a user in state, an unreachable server leaves the cached config alone', async () => {
    useStore.setState({ user: { id: 'u1', name: 'A' }, config: { coach: { enabled: true } } })
    api.mockRejectedValueOnce(new Error('offline'))
    expect(await useStore.getState().refreshConfig()).toBeNull()
    expect(useStore.getState().config.coach.enabled).toBe(true)
  })
})
