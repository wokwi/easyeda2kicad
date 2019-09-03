interface ISpectraList extends Array<ISpectraList | string | number | null> {}

export function encodeString(str: string) {
  if (/^[a-z][a-z0-9_]+$/.test(str)) {
    return str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function encodeNumber(value: number) {
  return (Math.round(value * 1000 + Number.EPSILON) / 1000).toString();
}

export function encodeValue(value: ISpectraList | string | number) {
  if (typeof value === 'string') {
    return encodeString(value);
  }
  if (typeof value === 'number') {
    return encodeNumber(value);
  }
  return encodeObject(value);
}

export function encodeObject(object: ISpectraList): string {
  return (
    '(' +
    object
      .filter((it) => it !== null)
      .map(encodeValue)
      .join(' ') +
    ')'
  );
}
