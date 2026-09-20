import type { LensClassification, LensDefinition, LensId, LensMapping, Market } from '../shared/contracts.js';

type Mapping = Omit<LensClassification, 'rawPermitType' | 'rawWorkType'> & { market: Market; permitType: string; workType?: string };

const chicagoExpress = 'PERMIT – EXPRESS PERMIT PROGRAM';
const source = {
  chicago: 'https://data.cityofchicago.org/Buildings/Building-Permits/ydr8-5enu',
  express: 'https://www.chicago.gov/city/en/depts/bldgs/provdrs/permits/svcs/express-permits.html',
  nyc: 'https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4',
};
const m = (market: Market, permitType: string, lens: Exclude<LensId, 'ALL'>, confidence: LensClassification['confidence'], ambiguity: string, workType?: string, officialSourceUrl = market === 'CHICAGO' ? source.chicago : source.nyc): Mapping => ({ market, permitType, workType, lens, confidence, ambiguity, officialSourceUrl });

/**
 * Literal source-value rules only.  These are a triage aid, not a common use code
 * or a score. Chicago Express mappings intentionally use the stored en dash.
 */
export const LENS_MAPPINGS: readonly Mapping[] = [
  m('CHICAGO', 'PERMIT - NEW CONSTRUCTION', 'GROUND_UP_SITE', 'HIGH', 'May include accessory structures; the retained description is needed to assess scale.'),
  m('CHICAGO', 'PERMIT - WRECKING/DEMOLITION', 'GROUND_UP_SITE', 'HIGH', 'Demolition does not establish that redevelopment will follow.'),
  m('CHICAGO', 'PERMIT - RENOVATION/ALTERATION', 'REINVESTMENT', 'MEDIUM', 'This broad source type ranges from minor interior work to major alteration.'),
  m('CHICAGO', 'PERMIT - ELEVATOR EQUIPMENT', 'BUILDING_SYSTEMS', 'HIGH', 'The type does not distinguish routine service from modernization.'),
  m('CHICAGO', 'PERMIT - SIGNS', 'SIGNAGE', 'HIGH', 'A sign record does not establish tenant occupancy or a lease event.'),
  m('CHICAGO', 'PERMIT - REINSTATE REVOKED PMT', 'ADMIN_LOW_INFORMATION', 'HIGH', 'Administrative reinstatement; not a new activity record.'),
  m('CHICAGO', 'PERMIT - EASY PERMIT PROCESS', 'UNCLASSIFIED', 'LOW', 'Legacy label whose current scope was not verified; it is not assumed equivalent to Express Permit work.'),
  m('CHICAGO', chicagoExpress, 'BUILDING_SYSTEMS', 'HIGH', 'System-work scope is not available in the type fields.', 'Electrical Work', source.express),
  m('CHICAGO', chicagoExpress, 'REINVESTMENT', 'MEDIUM', 'May be a small repair or a larger facade-restoration effort.', 'Masonry Work', source.express),
  m('CHICAGO', chicagoExpress, 'BUILDING_SYSTEMS', 'HIGH', 'The official label is small-scale; do not infer major capital scope.', 'Small-Scale Solar PV System', source.express),
  m('CHICAGO', chicagoExpress, 'ADMIN_LOW_INFORMATION', 'HIGH', 'Administrative filing; no new construction activity is established.', 'Administrative Change', source.express),
  m('CHICAGO', chicagoExpress, 'ADMIN_LOW_INFORMATION', 'MEDIUM', 'The source classifies this as maintenance, while this product lens treats recurring maintenance as low information.', 'Monthly Maintenance Permit', source.express),
  m('CHICAGO', chicagoExpress, 'BUILDING_SYSTEMS', 'MEDIUM', 'Not verified as a distinct official worktype; may be an electrical sub-label.', 'Fire Alarm System', source.express),
  m('CHICAGO', chicagoExpress, 'REINVESTMENT', 'HIGH', 'The type does not reveal whether work is a patch or full replacement.', 'Reroofing', source.express),
  m('CHICAGO', chicagoExpress, 'REINVESTMENT', 'MEDIUM', 'May be cosmetic work or a full fit-out.', 'Nonstructural Interior Work', source.express),
  m('CHICAGO', chicagoExpress, 'ADMIN_LOW_INFORMATION', 'HIGH', 'A minor amenity; the source does not call it administrative.', 'Fence or Trash Enclosure', source.express),
  m('CHICAGO', chicagoExpress, 'UNCLASSIFIED', 'LOW', 'Not verified against the official worktype list.', 'Detached Frame Garage', source.express),
  m('CHICAGO', chicagoExpress, 'BUILDING_SYSTEMS', 'HIGH', 'The type does not disclose scope.', 'Plumbing Work', source.express),
  m('CHICAGO', chicagoExpress, 'REINVESTMENT', 'MEDIUM', 'Exterior repair scale is not disclosed.', 'Porch,Deck,Balcony,or Fire Escape', source.express),
  m('CHICAGO', chicagoExpress, 'BUILDING_SYSTEMS', 'HIGH', 'The type does not disclose scope.', 'Mechanical Work', source.express),
  m('CHICAGO', chicagoExpress, 'UNCLASSIFIED', 'LOW', 'Catch-all source value with insufficient detail.', 'Other Work', source.express),
  m('CHICAGO', chicagoExpress, 'REINVESTMENT', 'HIGH', 'The type does not reveal whether one opening or a whole-building replacement is involved.', 'Exterior Windows/Doors Replacement', source.express),
  m('CHICAGO', chicagoExpress, 'TEMPORARY_LOGISTICS', 'HIGH', 'Temporary support can accompany work of many kinds.', 'Scaffolding', source.express),
  m('CHICAGO', chicagoExpress, 'BUILDING_SYSTEMS', 'HIGH', 'The type does not disclose scope.', 'Communication Equipment', source.express),
  m('CHICAGO', chicagoExpress, 'UNCLASSIFIED', 'LOW', 'Likely site/civil work, but no exact source definition was verified.', 'Storm Water Management Plan', source.express),
  m('CHICAGO', chicagoExpress, 'TEMPORARY_LOGISTICS', 'HIGH', 'Explicitly temporary; it does not establish capital scope.', 'Small Temporary Structure', source.express),
  m('CHICAGO', chicagoExpress, 'TEMPORARY_LOGISTICS', 'MEDIUM', 'Temporary site office; it indicates nearby activity rather than its scale.', 'Construction Trailer', source.express),
  m('NYC', 'General Construction', 'GROUND_UP_SITE', 'MEDIUM', 'Broad label that may include major alteration; it is retained for manual review.'),
  m('NYC', 'Foundation', 'GROUND_UP_SITE', 'HIGH', 'Foundation work is a clear lifecycle-stage label.'),
  m('NYC', 'Earth Work', 'GROUND_UP_SITE', 'HIGH', 'Site preparation label; it does not establish project size.'),
  m('NYC', 'Full Demolition', 'GROUND_UP_SITE', 'HIGH', 'Demolition does not establish that redevelopment will follow.'),
  m('NYC', 'Support of Excavation', 'GROUND_UP_SITE', 'HIGH', 'Site-preparation label; it does not establish project size.'),
  m('NYC', 'Structural', 'REINVESTMENT', 'MEDIUM', 'May represent a minor repair or major structural renovation.'),
  ...['Plumbing', 'Mechanical Systems', 'Sprinklers', 'Standpipe', 'Boiler Equipment', 'Solar'].map(type => m('NYC', type, 'BUILDING_SYSTEMS', 'HIGH', 'The source work type does not disclose scope.')),
  m('NYC', 'Green Roof', 'BUILDING_SYSTEMS', 'MEDIUM', 'Could also be treated as reinvestment; retained as a borderline systems rule.'),
  m('NYC', 'Antenna', 'BUILDING_SYSTEMS', 'MEDIUM', 'May be a large rooftop installation or a small equipment addition.'),
  ...['Sidewalk Shed', 'Construction Fence', 'Supported Scaffold', 'Suspended Scaffold'].map(type => m('NYC', type, 'TEMPORARY_LOGISTICS', 'HIGH', 'Temporary protection or support; it does not establish the nature of underlying work.')),
  m('NYC', 'Protection and Mechanical Methods', 'TEMPORARY_LOGISTICS', 'MEDIUM', 'Compound label may span temporary protection and mechanical work.'),
  m('NYC', 'Curb Cut', 'UNCLASSIFIED', 'LOW', 'Civil/site-access work does not cleanly fit a deterministic lens.'),
  m('NYC', 'Sign', 'SIGNAGE', 'HIGH', 'A sign record does not establish tenant occupancy or a lease event.'),
];

export const LENS_DEFINITIONS: readonly LensDefinition[] = [
  { id: 'ALL', label: 'All records', rankingTreatment: 'ALL_RECORDS', description: 'Every accepted source record remains visible. Temporary, administrative, and unknown records are included.' },
  { id: 'GROUND_UP_SITE', label: 'Ground-up / site', rankingTreatment: 'PRIMARY', description: 'Literal source labels for new construction, demolition, excavation, or foundation work.' },
  { id: 'REINVESTMENT', label: 'Reinvestment', rankingTreatment: 'PRIMARY', description: 'Literal alteration, envelope, and selected repair labels; not a value or use classification.' },
  { id: 'BUILDING_SYSTEMS', label: 'Building systems', rankingTreatment: 'PRIMARY', description: 'Literal mechanical, electrical, plumbing, life-safety, and related system labels.' },
  { id: 'TEMPORARY_LOGISTICS', label: 'Temporary logistics', rankingTreatment: 'DEPRIORITIZED', description: 'Temporary support and protection records remain visible but are not prioritized.' },
  { id: 'SIGNAGE', label: 'Signage', rankingTreatment: 'DEPRIORITIZED', description: 'Sign records remain visible but do not establish occupancy or leasing.' },
  { id: 'ADMIN_LOW_INFORMATION', label: 'Administrative / low information', rankingTreatment: 'DEPRIORITIZED', description: 'Procedural, recurring-maintenance, or minor-amenity records remain visible.' },
  { id: 'UNCLASSIFIED', label: 'Unclassified', rankingTreatment: 'DEPRIORITIZED', description: 'Known ambiguous and future unknown source values remain visible for review.' },
];

function workType(raw: Record<string, unknown>): string | null { const value = raw.work_type; return typeof value === 'string' && value.trim() ? value.trim() : null; }

export function classifyPermit(market: Market, permitType: string, raw: Record<string, unknown>): LensClassification {
  const retainedWorkType = workType(raw);
  const match = LENS_MAPPINGS.find(item => item.market === market && item.permitType === permitType && (market === 'NYC' || item.workType === undefined || item.workType === retainedWorkType));
  if (match) return { lens: match.lens, confidence: match.confidence, ambiguity: match.ambiguity, officialSourceUrl: match.officialSourceUrl, rawPermitType: permitType, rawWorkType: retainedWorkType };
  return { lens: 'UNCLASSIFIED', confidence: 'LOW', ambiguity: 'This exact source-value combination is not in the versioned mapping and requires review; it remains visible.', officialSourceUrl: market === 'CHICAGO' ? source.chicago : source.nyc, rawPermitType: permitType, rawWorkType: retainedWorkType };
}

type SqlFilter = { clause: string; params: string[] };
function mappingSql(item: Mapping): SqlFilter {
  if (item.market === 'NYC' || item.workType === undefined) return { clause: '(permit_type = ?)', params: [item.permitType] };
  return { clause: "(permit_type = ? AND json_extract(raw_json, '$.work_type') = ?)", params: [item.permitType, item.workType] };
}

/** SQL equivalent of classifyPermit. It intentionally leaves unknown future values in UNCLASSIFIED. */
export function lensWhere(market: Market, lens: LensId): SqlFilter {
  if (lens === 'ALL') return { clause: '', params: [] };
  const all = LENS_MAPPINGS.filter(item => item.market === market);
  const selected = all.filter(item => item.lens === lens);
  const join = (items: readonly Mapping[]) => {
    const values = items.map(mappingSql);
    return { clause: values.map(value => value.clause).join(' OR '), params: values.flatMap(value => value.params) };
  };
  if (lens !== 'UNCLASSIFIED') { const result = join(selected); return { clause: ` AND (${result.clause})`, params: result.params }; }
  const explicit = join(selected), known = join(all);
  return { clause: ` AND ((${explicit.clause}) OR NOT (${known.clause}))`, params: [...explicit.params, ...known.params] };
}

export function lensDefinition(id: LensId): LensDefinition { return LENS_DEFINITIONS.find(item => item.id === id)!; }
export function mappingsForMarket(market: Market): LensMapping[] {
  return LENS_MAPPINGS.filter(item => item.market === market).map(item => ({
    market, lens: item.lens, confidence: item.confidence, ambiguity: item.ambiguity, officialSourceUrl: item.officialSourceUrl,
    rawPermitType: item.permitType, rawWorkType: item.workType ?? null,
  }));
}
