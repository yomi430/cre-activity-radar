for (const [market, base, dateField] of [['CHICAGO', 'https://data.cityofchicago.org/resource/ydr8-5enu.json', 'issue_date'], ['NYC', 'https://data.cityofnewyork.us/resource/rbx6-tga4.json', 'issued_date']]) {
  const url = new URL(base); url.searchParams.set('$limit', '1');
  url.searchParams.set('$where', `${dateField} >= '2024-07-01T00:00:00' AND ${dateField} < '2026-07-01T00:00:00'`);
  const response = await fetch(url); if (!response.ok) throw new Error(`${market} sample ${response.status}`);
  console.log(market, JSON.stringify((await response.json())[0]));
}
