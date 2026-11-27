export type PartnerRechargePackageInput = {
  id: string;
  name: string;
  amountRupees: number;
  durationDays: number;
  active: boolean;
};

export type PartnerRechargePolicyInput = {
  trialDays: number;
  packages: PartnerRechargePackageInput[];
};

export type PartnerRechargePolicyResult =
  | { valid: true; value: PartnerRechargePolicyInput }
  | { valid: false; error: string };

/** Validate and normalize Admin-managed recharge policy before it is persisted. */
export function validatePartnerRechargePolicy(input: unknown): PartnerRechargePolicyResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { valid: false, error: 'Recharge policy must be an object.' };
  }

  const value = input as Record<string, unknown>;
  const trialDays = value.trialDays;
  const packages = value.packages;

  if (!Number.isInteger(trialDays) || (trialDays as number) < 0 || (trialDays as number) > 365) {
    return { valid: false, error: 'Free trial limit must be between 0 and 365 days.' };
  }
  if (!Array.isArray(packages) || packages.length < 1 || packages.length > 20) {
    return { valid: false, error: 'Provide between 1 and 20 packages.' };
  }

  const ids = new Set<string>();
  const normalized: PartnerRechargePackageInput[] = [];
  for (const item of packages) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, error: 'A package has invalid details.' };
    }
    const pkg = item as Record<string, unknown>;
    if (typeof pkg.id !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(pkg.id) || ids.has(pkg.id) ||
        typeof pkg.name !== 'string' || !pkg.name.trim() || pkg.name.trim().length > 80 ||
        !Number.isInteger(pkg.amountRupees) || (pkg.amountRupees as number) < 1 || (pkg.amountRupees as number) > 1000000 ||
        !Number.isInteger(pkg.durationDays) || (pkg.durationDays as number) < 1 || (pkg.durationDays as number) > 3650 ||
        typeof pkg.active !== 'boolean') {
      return { valid: false, error: 'A package has invalid ID, name, amount, duration or active status.' };
    }
    ids.add(pkg.id);
    normalized.push({
      id: pkg.id,
      name: pkg.name.trim(),
      amountRupees: pkg.amountRupees as number,
      durationDays: pkg.durationDays as number,
      active: pkg.active
    });
  }

  return { valid: true, value: { trialDays: trialDays as number, packages: normalized } };
}
