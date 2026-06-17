/**
 * Inventory of UI surfaces deferred to later milestones.
 * tests/e2e/deferred-features-visible.spec.ts asserts each entry is rendered
 * (greyed, aria-disabled, with a tooltip). Stays in sync as features ship and
 * deferred entries are promoted to live UI.
 */
export interface DeferredEntry {
  selector: string;     // CSS selector to find the element
  milestone: string;    // e.g. "SP5"
  reason: string;       // human description
  route?: string;       // route where element appears (default: '/')
}

export const DEFERRED_INVENTORY: DeferredEntry[] = [
  // Topology / Netmap shipped (SP8) -- now a live nav entry, no longer deferred.
  { selector: '[data-deferred="backend-restart"]', milestone: 'SP4', reason: 'Backend restart status chip -- actual restart is on the Admin / Actions page' },
  // custom-fields + vlan-cross-device placeholders removed: the redesigned
  // Details tab exposes custom_fields via "All fields", and the
  // vlan-cross-device placeholder no longer exists in the VLANs tab.
];
