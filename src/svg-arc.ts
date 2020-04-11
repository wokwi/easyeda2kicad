/* SVG Arc Utility function, based on Apache Batik code:
 * https://xmlgraphics.apache.org/batik/
 *
 * Algorithm taken from org.apache.batik.ext.awt.geom.ExtendedGeneralPath::computeArc()
 * with slight adaptations.
 *
 * Original copyright notice follows.
 */

function toRadians(n: number) {
  return (n / 180) * Math.PI;
}

function toDegrees(n: number) {
  return (n / Math.PI) * 180;
}

/*
   Copyright 2001-2003  The Apache Software Foundation

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */
export function computeArc(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  angle: number,
  largeArcFlag: boolean,
  sweepFlag: boolean,
  x: number,
  y: number
) {
  //
  // Elliptical arc implementation based on the SVG specification notes
  //

  // Compute the half distance between the current and the final point
  const dx2 = (x0 - x) / 2.0;
  const dy2 = (y0 - y) / 2.0;
  // Convert angle from degrees to radians
  angle = toRadians(angle % 360.0);
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);

  //
  // Step 1 : Compute (x1, y1)
  //
  const x1 = cosAngle * dx2 + sinAngle * dy2;
  const y1 = -sinAngle * dx2 + cosAngle * dy2;
  // Ensure radii are large enough
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  let Prx = rx * rx;
  let Pry = ry * ry;
  const Px1 = x1 * x1;
  const Py1 = y1 * y1;
  // check that radii are large enough
  const radiiCheck = Px1 / Prx + Py1 / Pry;
  if (radiiCheck > 1) {
    rx = Math.sqrt(radiiCheck) * rx;
    ry = Math.sqrt(radiiCheck) * ry;
    Prx = rx * rx;
    Pry = ry * ry;
  }

  //
  // Step 2 : Compute (cx1, cy1)
  //
  let sign = largeArcFlag === sweepFlag ? -1 : 1;
  let sq = (Prx * Pry - Prx * Py1 - Pry * Px1) / (Prx * Py1 + Pry * Px1);
  sq = sq < 0 ? 0 : sq;
  const coef = sign * Math.sqrt(sq);
  const cx1 = coef * ((rx * y1) / ry);
  const cy1 = coef * -((ry * x1) / rx);

  //
  // Step 3 : Compute (cx, cy) from (cx1, cy1)
  //
  const sx2 = (x0 + x) / 2.0;
  const sy2 = (y0 + y) / 2.0;
  const cx = sx2 + (cosAngle * cx1 - sinAngle * cy1);
  const cy = sy2 + (sinAngle * cx1 + cosAngle * cy1);

  //
  // Step 4 : Compute the angleStart (angle1) and the angleExtent (dangle)
  //
  const ux = (x1 - cx1) / rx;
  const uy = (y1 - cy1) / ry;
  const vx = (-x1 - cx1) / rx;
  const vy = (-y1 - cy1) / ry;
  // Compute the angle start
  let n = Math.sqrt(ux * ux + uy * uy);
  let p = ux; // (1 * ux) + (0 * uy)
  sign = uy < 0 ? -1 : 1;
  let angleStart = toDegrees(sign * Math.acos(p / n));

  // Compute the angle extent
  n = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
  p = ux * vx + uy * vy;
  sign = ux * vy - uy * vx < 0 ? -1 : 1;
  let angleExtent = toDegrees(sign * Math.acos(p / n));
  if (!sweepFlag && angleExtent > 0) {
    angleExtent -= 360;
  } else if (sweepFlag && angleExtent < 0) {
    angleExtent += 360;
  }
  angleExtent %= 360;
  angleStart %= 360;

  //
  // We can now build the resulting Arc2D in double precision
  //
  return {
    cx,
    cy,
    width: rx * 2.0,
    height: ry * 2.0,
    start: angleStart,
    extent: angleExtent,
  };
}
