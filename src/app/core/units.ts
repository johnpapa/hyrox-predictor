/** Shared display helpers: every weight is shown in both kg and lb, every height in cm and ft/in. */

export const LB_PER_KG = 2.20462;

/** "60 kg / 132 lb". */
export function kgLb(kg: number): string {
  return `${Math.round(kg)} kg / ${Math.round(kg * LB_PER_KG)} lb`;
}

/** "170 cm / 5′7″". */
export function cmFtIn(cm: number): string {
  const inches = Math.round(cm / 2.54);
  return `${Math.round(cm)} cm / ${Math.floor(inches / 12)}′${inches % 12}″`;
}
