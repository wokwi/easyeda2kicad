export interface ICoordinates {
  x: number;
  y: number;
}

export interface IParentTransform extends ICoordinates {
  angle: number | null;
}

export function flatten<T>(arr: T[]) {
  return ([] as T[]).concat(...arr);
}

export function kiUnits(value: string | number) {
  if (typeof value === 'string') {
    value = parseFloat(value);
  }
  return value * 10 * 0.0254;
}

export function kiAngle(value?: string | number, parentAngle?: number | number) {
  if (value) {
    if (typeof value === 'string') {
      value = parseFloat(value);
    }

    const angle = value + (parentAngle || 0);
    if (!isNaN(angle)) {
      return angle > 180 ? -(360 - angle) : angle;
    }
  }
  return null;
}

export function rotate({ x, y }: ICoordinates, degrees: number) {
  const radians = (degrees / 180) * Math.PI;
  return {
    x: x * Math.cos(radians) - y * Math.sin(radians),
    y: x * Math.sin(radians) + y * Math.cos(radians),
  };
}

export function kiCoords(
  x: string | number,
  y: string | number,
  transform: IParentTransform = { x: 0, y: 0, angle: 0 }
): ICoordinates {
  if (typeof x === 'string') {
    x = parseFloat(x);
  }
  if (typeof y === 'string') {
    y = parseFloat(y);
  }
  return rotate(
    {
      x: kiUnits(x - 4000) - transform.x,
      y: kiUnits(y - 3000) - transform.y,
    },
    transform.angle || 0
  );
}

export function kiAt(
  x: string | number,
  y: string | number,
  angle?: string | number,
  transform?: IParentTransform
) {
  const coords = kiCoords(x, y, transform);
  return ['at', coords.x, coords.y, kiAngle(angle)];
}

export function uuid(id: string) {
  return ['uuid', id];
}
