export type OnboardingTask = {
  id: string
  title: string
  done: boolean
}

export const onboardingChecklist: OnboardingTask[] = [
  { id: 'connect-models', title: 'Connect at least one AI model provider', done: false },
  { id: 'enable-integrations', title: 'Enable required integrations (email, messaging, web)', done: false },
  { id: 'set-permissions', title: 'Set permissions for messaging, calls, and automation', done: false },
  { id: 'run-first-command', title: 'Run first real-world command', done: false },
  { id: 'verify-backup', title: 'Create first backup snapshot', done: false },
]}
