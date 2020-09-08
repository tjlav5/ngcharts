export type DataValue = number | string | null;

export interface DataPoint<X = DataValue, Y = DataValue> {
  x: X;
  y: Y;
}

export type AxisId = string | symbol;
