const base = "https://data.cityofnewyork.us";

async function get(path) {
  const response = await fetch(`${base}${path}`, {
    headers: { "User-Agent": "cre-activity-radar-research/0.1" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${path}`);
  return response.json();
}

const query = (id, params) =>
  `/resource/${id}.json?${new URLSearchParams(params).toString()}`;

const [projects, statuses, projectCounts, filingCoverage, plutoRows, plutoTotal, plutoMissing, projectMetadata, bblMetadata, plutoMetadata] =
  await Promise.all([
    get(query("hgx4-8ukb", { "$limit": "3" })),
    get(query("hgx4-8ukb", { "$select": "project_status, count(*) as rows", "$group": "project_status", "$order": "rows desc", "$limit": "200" })),
    get(query("hgx4-8ukb", { "$select": "count(*) as total, count(project_id) as nonnull_ids, count(distinct project_id) as distinct_ids" })),
    get(query("hgx4-8ukb", { "$select": "count(*) as total, count(app_filed_date) as with_filed_date, min(app_filed_date) as earliest_filed, max(app_filed_date) as latest_filed" })),
    get(query("64uk-42ks", { "$select": "bbl,latitude,longitude,xcoord,ycoord,borough,block,lot", "$limit": "3" })),
    get(query("64uk-42ks", { "$select": "count(*) as total" })),
    get(query("64uk-42ks", { "$select": "count(*) as missing", "$where": "latitude IS NULL OR longitude IS NULL" })),
    get("/api/views/hgx4-8ukb.json"),
    get("/api/views/2iga-a6mk.json"),
    get("/api/views/64uk-42ks.json"),
  ]);

const columns = (metadata) => metadata.columns.map((column) => ({
  name: column.name,
  fieldName: column.fieldName,
  dataTypeName: column.dataTypeName,
}));

console.log(JSON.stringify({
  retrievedAt: new Date().toISOString(),
  projectSample: projects,
  projectSampleKeys: [...new Set(projects.flatMap(Object.keys))].sort(),
  statusCounts: statuses,
  projectCounts: projectCounts[0],
  filingCoverage: filingCoverage[0],
  plutoSample: plutoRows,
  plutoCounts: { total: plutoTotal[0], missingCoordinates: plutoMissing[0] },
  metadata: {
    projects: { rowsUpdatedAt: projectMetadata.rowsUpdatedAt, columns: columns(projectMetadata) },
    projectBbl: { rowsUpdatedAt: bblMetadata.rowsUpdatedAt, columns: columns(bblMetadata) },
    pluto: { rowsUpdatedAt: plutoMetadata.rowsUpdatedAt, columns: columns(plutoMetadata).filter((column) => ["bbl", "latitude", "longitude", "xcoord", "ycoord", "borough", "block", "lot"].includes(column.fieldName)) },
  },
}, null, 2));
