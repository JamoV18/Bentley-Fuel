export function recordsForExactMenuDate<T extends { menuDate?: string }>(records: readonly T[], intendedDate: string): T[] {
  return records.filter((record) => record.menuDate === intendedDate);
}
