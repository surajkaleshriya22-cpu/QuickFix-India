export type QuickFixAccountKind = 'CUSTOMER' | 'PARTNER';

export const normalizeQuickFixId = (value: unknown, kind: QuickFixAccountKind): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  const prefix = kind === 'CUSTOMER' ? 'QFC' : 'QFP';
  return new RegExp('^' + prefix + '-\\d{8}$').test(normalized) ? normalized : null;
};
