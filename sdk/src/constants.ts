/**
 * Default API configuration
 */
export const DEFAULT_API_URL = 'http://localhost:3000';
export const DEFAULT_WS_URL = 'ws://localhost:3000';
export const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * WebSocket event types
 */
export const WS_EVENTS = {
  ILI_UPDATE: 'ili:update',
  PROPOSAL_UPDATE: 'proposal:update',
  RESERVE_UPDATE: 'reserve:update',
  VOTE_UPDATE: 'vote:update',
} as const;

/**
 * API endpoints
 */
export const ENDPOINTS = {
  ILI_CURRENT: '/ili/current',
  ILI_HISTORY: '/ili/history',
  ICR_CURRENT: '/icr/current',
  RESERVE_STATE: '/reserve/state',
  PROPOSALS_LIST: '/proposals',
  PROPOSAL_DETAIL: '/proposals/:id',
  PROPOSAL_CREATE: '/proposals/create',
  PROPOSAL_VOTE: '/proposals/:id/vote',
} as const;

/**
 * Policy types
 */
export const POLICY_TYPES = {
  MINT: 'mint',
  BURN: 'burn',
  ICR_UPDATE: 'icr_update',
  REBALANCE: 'rebalance',
} as const;

/**
 * Proposal statuses
 */
export const PROPOSAL_STATUS = {
  ACTIVE: 'active',
  PASSED: 'passed',
  REJECTED: 'rejected',
  EXECUTED: 'executed',
} as const;
