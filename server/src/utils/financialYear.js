// India ka financial year: 1 April se 31 March.
// 5 Aug 2026 -> "26-27"
export function getFinancialYear(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0 = Jan
  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

export function getFinancialYearRange(fy) {
  const [start] = fy.split('-');
  const startYear = 2000 + Number(start);
  return {
    from: new Date(startYear, 3, 1, 0, 0, 0),
    to: new Date(startYear + 1, 2, 31, 23, 59, 59),
  };
}
