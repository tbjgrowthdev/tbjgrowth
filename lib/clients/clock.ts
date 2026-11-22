// The current time for the Client Hub admin code, in one place so tests can
// fix it (tests/client-projects-actions.test.ts mocks this module).
export const now = (): Date => new Date();
