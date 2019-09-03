interface ISpectraList extends Array<ISpectraList | string | number | null> {}

export function encodeString(str: string) {
  if (/^[a-z][a-z0-9_]+$/.test(str)) {
    return str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function encodeItem(item: ISpectraList | string | number) {
  if (typeof item === 'string') {
    return encodeString(item);
  }
  if (typeof item === 'number') {
    return item.toString();
  }
  return encodeObject(item);
}

export function encodeObject(object: ISpectraList): string {
  return (
    '(' +
    object
      .filter((it) => it !== null)
      .map(encodeItem)
      .join(' ') +
    ')'
  );
}
