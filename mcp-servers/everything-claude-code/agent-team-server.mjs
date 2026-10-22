#!/usr/bin/env node
/**
 * Everything Claude Code - Multi-Agent Team Orchestration Server
 * Based on https://github.com/WorldFlowAI/everything-claude-code
 * Spawns and coordinates specialized agents: planner, architect, security-reviewer, tdd-guide, e2e-runner
 */

export const AGENT_TEAM = [
  {
    id: "planner",
    name: "Planner Agent",
    role: "Decomposes multi-owner banking verification workflows and co-ownership rules",
    status: "active",
  },
  {
    id: "architect",
    name: "System Architect Agent",
    role: "Designs Supabase persistence, Kilo Gateway 5-key JWT rotation, and MCP integration",
    status: "active",
  },
  {
    id: "security-reviewer",
    name: "Tide & Security Reviewer Agent",
    role: "Enforces server-side multi-owner approval invariants, expiration rules, and anti-spoofing liveness",
    status: "active",
  },
  {
    id: "tdd-guide",
    name: "TDD Verification Agent",
    role: "Validates unit, integration, and API behavior across all banking flows",
    status: "active",
  },
  {
    id: "e2e-runner",
    name: "Playwright E2E Agent",
    role: "Tests real browser workflows for sign-in, fund creation, invitations, add/deduct, and face verification",
    status: "active",
  },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify({ server: "everything-claude-code", agents: AGENT_TEAM }, null, 2));
}
