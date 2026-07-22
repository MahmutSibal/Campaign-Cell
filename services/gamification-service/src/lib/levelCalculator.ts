export function calculateLevel(totalPoints: number): string {
  if (totalPoints >= 3000) return 'PLATIN';
  if (totalPoints >= 1500) return 'ALTIN';
  if (totalPoints >= 500) return 'GÜMÜŞ';
  return 'BRONZ';
}
