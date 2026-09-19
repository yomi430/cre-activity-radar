const windows = { start: '2024-07-01T00:00:00', end: '2026-07-01T00:00:00' };
const sources = [
  ['CHICAGO', 'https://data.cityofchicago.org/resource/ydr8-5enu.json', 'issue_date'],
  ['NYC', 'https://data.cityofnewyork.us/resource/rbx6-tga4.json', 'issued_date']
];
for (const [market, base, dateField] of sources) {
  const url = new URL(base); url.searchParams.set('$select', 'count(*)'); url.searchParams.set('$where', `${dateField} >= '${windows.start}' AND ${dateField} < '${windows.end}'`);
  const response = await fetch(url); if (!response.ok) throw new Error(`${market} count ${response.status}: ${await response.text()}`);
  console.log(`${market} ${await response.text()}`);
}
