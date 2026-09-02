export interface Installment { installmentNumber: number; dueDate: string; capitalDue: number; interestDue: number; totalDue: number }
export function buildAmortizationSchedule(amount: number, annualRate: number, durationMonths: number, startDate: string): Installment[];
export function roundMoney(value: number): number;
export function validateAvailableAmount(amount: number, committed: number, ceiling: number, label: string): string | null;
export function validateImpact(input: Record<string, unknown>): string | null;
