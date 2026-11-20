import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'
import { vi } from 'vitest'

// CI runners are much slower than a laptop, and tests that type and click through
// forms in jsdom can pass the default limits there even though nothing is wrong.
// Give each test 20s (default 5s) and each findBy/waitFor 5s (default 1s).
vi.setConfig({ testTimeout: 20000 })
configure({ asyncUtilTimeout: 5000 })
