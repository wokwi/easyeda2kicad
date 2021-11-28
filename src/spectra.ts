export interface ISpectraList extends Array<ISpectraList | string | number | null> {}

const WHITESPACE = [' ', '\t', '\r', '\n'];

function notNull<TValue>(value: TValue | null): value is TValue {
  return value !== null;
}

export function encodeString(str: string) {
  if (/^[a-z][a-z0-9_]+$/.test(str)) {
    return str;
  }
  return `"${str.replace(/"/g, '\\"')}"`;
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
  return '(' + object.filter(notNull).map(encodeValue).join(' ') + ')';
}

function parseElement(input: string): [ISpectraList | string | number, number] {
  let idx = 0;
  while (WHITESPACE.includes(input[idx])) {
    idx++;
  }
  if (idx >= input.length) {
    throw new Error('Unexpected end of string');
  }
  if (input[idx] === '(') {
    idx++;
    const result = [];
    while (input[idx] !== ')') {
      if (idx >= input.length) {
        throw new Error('Unexpected end of string');
      }
      const [element, len] = parseElement(input.substr(idx));
      result.push(element);
      idx += len;
    }
    return [result, idx + 1];
  } else if (input[idx] === '"') {
    idx++;
    let result = '';
    while (input[idx] !== '"') {
      result += input[idx];
      idx++;
      if (input.substr(idx, 2) === '""') {
        result += '"';
        idx += 2;
      }
    }
    return [result, idx + 1];
  } else {
    let result = '';
    while (![...WHITESPACE, '(', ')'].includes(input[idx])) {
      if (idx >= input.length) {
        throw new Error('Unexpected end of string');
      }
      result += input[idx];
      idx++;
    }
    const numVal = parseFloat(result);
    if (typeof numVal === 'number' && !isNaN(numVal)) {
      return [numVal, idx];
    } else {
      return [result, idx];
    }
  }
}

export function parseObject(spectra: string) {
  spectra = spectra.trim();
  const [parsed] = parseElement(spectra);
  return parsed;
}
