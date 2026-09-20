/** Pure helpers for the bounded NYC ACRIS source audit. */
export function canonicalAcrisBbl(borough, block, lot) {
  const parse = (value, maximum) => {
    const source = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
    if (!/^\d+$/.test(source)) return null;
    const parsed = Number(source);
    return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
  };
  const b = parse(borough, 9), bl = parse(block, 99_999), l = parse(lot, 9_999);
  return b && b <= 4 && bl !== null && l !== null ? `${b}${String(bl).padStart(5, '0')}${String(l).padStart(4, '0')}` : null;
}

export function normalizedLegalAssociation(row) {
  const bbl = canonicalAcrisBbl(row.borough, row.block, row.lot);
  const flag = key => String(row[key] ?? '').trim().toUpperCase();
  return {
    documentId: String(row.document_id ?? '').trim(),
    bbl,
    easement: flag('easement'),
    partialLot: flag('partial_lot'),
    airRights: flag('air_rights'),
    subterraneanRights: flag('subterranean_rights'),
  };
}

export function legalAssociationIdentity(row) {
  const value = normalizedLegalAssociation(row);
  return [value.documentId, value.bbl ?? 'INVALID_BBL', value.easement, value.partialLot, value.airRights, value.subterraneanRights].join('|');
}

export function distribution(values, overflowAt = 5) {
  const result = {};
  for (const value of values) {
    const numeric = Number(value);
    const key = Number.isFinite(numeric) && numeric >= overflowAt ? `${overflowAt}+` : String(numeric);
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => Number(left.replace('+', '')) - Number(right.replace('+', ''))));
}

export function rate(numerator, denominator) {
  return denominator ? Number((numerator / denominator * 100).toFixed(4)) : null;
}
