import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { LayoutStore } from './layout';
import { curveLinear, line } from 'd3-shape';
import { DataStore } from './data';
import { scaleLinear, scaleOrdinal, scalePoint, scaleLog } from 'd3-scale';
import { DataPoint, DataValue } from '../types';
import { Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

enum AxisPlane {
  X,
  Y,
  Z,
}

enum AxisType {
  NUMBER,
  CATEGORY,
}

enum AxisScale {
  LINEAR,
  // POW,
  // SQRT,
  LOG,
  // IDENTITY,
  // TIME,
  // BAND,
  // POINT,
  ORDINAL,
  // QUANTILE,
  // QUANTIZE,
  // UTC,
  // SEQUENTIAL,
  // THRESHOLD,
}

interface AxisState {
  label?: string;
  plane: AxisPlane;
  scale: AxisScale;
  type: AxisType;
}

interface CartesianState {
  axis: {
    [id: string]: AxisState;
  };
}

export const DEFAULT_X_AXIS: string = (Symbol() as unknown) as string;
export const DEFAULT_Y_AXIS: string = (Symbol() as unknown) as string;

@Injectable()
export class CartesianStore extends ComponentStore<CartesianState> {
  readonly addAxis$ = this.updater<{ id: string } & AxisState>(
    (state, { id, ...axis }) => ({
      ...state,
      axis: { ...state.axis, [id]: axis },
    })
  );

  /**
   * Standard cartesian-components may need to add a stand-in axis with basic settings.
   */
  readonly conditionallyAddAxis$ = this.updater<{ id: string } & AxisState>(
    (state, { id, ...axis }) => {
      if (state.axis[id]) {
        return state;
      }
      return {
        ...state,
        axis: { ...state.axis, [id]: axis },
      };
    }
  );

  /**
   * HMM... removing an axis after lines/etc are rendered would drop scales/etc :(
   * Perhaps this can't be removed, and only overwritten?
   */
  readonly removeAxis$ = this.updater((state, id: string) => {
    const { [id]: remove, ...keep } = state.axis;
    return {
      ...state,
      axis: keep,
    };
  });

  readonly allAxes$ = this.select(this.state$, (state) => state.axis, {
    debounce: true,
  });

  getAxis(id: string) {
    return this.select(this.allAxes$, (axes) => axes[id]);
  }

  private getMinMaxByAxis(axisId: string) {
    return this.select(this.dataStore.getDataByAxis<number>(axisId), (data) => {
      let min = Infinity;
      let max = -Infinity;

      for (const d of data as number[]) {
        if (d < min) min = d;
        if (d > max) max = d;
      }

      return [min, max];
    });
  }

  private getLinearScaleGenerator(axisId: string) {
    return this.select(
      this.getMinMaxByAxis(axisId),
      this.getRangeByAxis(axisId),
      (data, range) => {
        const scale = scaleLinear();
        scale.domain(data);
        scale.range(range);
        return scale;
      }
    );
  }

  private getLogScaleGenerator(axisId: string) {
    return this.select(
      this.getMinMaxByAxis(axisId),
      this.getRangeByAxis(axisId),
      ([min, max], range) => {
        const scale = scaleLog();
        // A log scale can not, by very definition, include 0 in its domain.
        scale.domain([min || 0.001, max]);
        scale.range(range);
        return scale;
      }
    );
  }

  private getOrdinalScaleGenerator(axisId: string) {
    return this.select(
      this.dataStore.getDataByAxis<string>(axisId),
      this.getRangeByAxis(axisId),
      (data, range) => {
        const scale = scalePoint();
        scale.domain(data.map((d) => `${d}`));
        scale.range(range);
        return scale;
      }
    );
  }

  private getRangeByAxis(axisId: string): Observable<[number, number]> {
    return this.select(
      this.getAxis(axisId),
      this.layoutStore.size$,
      this.layoutStore.margins$,
      (axis, size, margins) => {
        if (axis.plane === AxisPlane.X) {
          return [margins.left, size.width - margins.right];
        } else if (axis.plane === AxisPlane.Y) {
          return [size.height - margins.top - margins.bottom, margins.top];
        }
      }
    );
  }

  private getOrdinalScale(axisId: string) {
    return this.select(
      this.dataStore.getDataByAxis<string>(axisId),
      this.getRangeByAxis(axisId),
      (data, range) => {
        const scale = scalePoint();
        scale.domain(data.filter((d) => d !== null));
        scale.range(range);
        return scale;
      }
    ).pipe(
      map((scale) => ({
        scale: (dataValue: string) => scale(dataValue),
        ticks: scale.domain(),
        range: scale.range(),
      }))
    );
  }

  private getLinearScale(axisId: string) {
    return this.select(
      this.getMinMaxByAxis(axisId),
      this.getRangeByAxis(axisId),
      (data, range) => {
        const scale = scaleLinear();
        scale.domain(data);
        scale.range(range);
        return scale;
      }
    ).pipe(
      map((scale) => ({
        scale: (dataValue: number) => scale(dataValue),
        ticks: scale.ticks(),
        range: scale.range(),
      }))
    );
  }

  private getLogScale(axisId: string) {
    return this.select(
      this.getMinMaxByAxis(axisId),
      this.getRangeByAxis(axisId),
      ([min, max], range) => {
        const scale = scaleLog();
        // A log scale can not, by very definition, include 0 in its domain.
        scale.domain([min || 0.001, max]);
        scale.range(range);
        return scale;
      }
    ).pipe(
      map((scale) => ({
        scale: (dataValue: number) => scale(dataValue),
        ticks: scale.ticks(),
        range: scale.range(),
      }))
    );
  }

  getScaleByAxis(
    axisId: string
  ): Observable<{
    scale: (dataValue: DataValue) => number;
    ticks: (number | string)[];
    range: number[];
  }> {
    return this.getAxis(axisId).pipe(
      switchMap((axis) => {
        if (axis.scale === AxisScale.ORDINAL) {
          return this.getOrdinalScale(axisId);
        }
        if (axis.scale === AxisScale.LINEAR) {
          return this.getLinearScale(axisId);
        }
        if (axis.scale === AxisScale.LOG) {
          return this.getLogScale(axisId);
        }
      })
    );
  }

  getLineGenerator(primaryAxisId: string, secondaryAxisId: string) {
    return this.select(
      this.getScaleByAxis(primaryAxisId),
      this.getScaleByAxis(secondaryAxisId),
      (xScale, yScale) => {
        return (dataPoint: DataPoint) => {
          if (dataPoint.y === null) {
            const [min, max] = yScale.range;
            return {
              x1: xScale.scale(dataPoint.x),
              x2: xScale.scale(dataPoint.x),
              y1: min,
              y2: max,
            };
          }
          if (dataPoint.x === null) {
            const [min, max] = xScale.range;
            return {
              x1: min,
              x2: max,
              y1: yScale.scale(dataPoint.y),
              y2: yScale.scale(dataPoint.y),
            };
          }
        };
      }
    );
  }

  getPathGenerator(
    primaryAxisId: string,
    secondaryAxisId: string
  ): Observable<(dataPoints: DataPoint[]) => { d: string }> {
    return this.select(
      this.getScaleByAxis(primaryAxisId),
      this.getScaleByAxis(secondaryAxisId),
      (xScale, yScale) => {
        return (dataPoints: DataPoint[]) => ({
          d: line()
            .curve(curveLinear)
            .x((d) => xScale.scale(d[0]))
            .y((d) => yScale.scale(d[1]))(
            dataPoints.map((d) => [d.x as number, d.y as number])
          ),
        });
      }
    );
  }

  getPointGenerator(
    primaryAxisId: string,
    secondaryAxisId: string
  ): Observable<
    (dataPoint: DataPoint) => { cx: number; cy: number; r: number }
  > {
    return this.select(
      this.getScaleByAxis(primaryAxisId),
      this.getScaleByAxis(secondaryAxisId),
      (xScale, yScale) => {
        return (data: DataPoint) => ({
          cx: xScale.scale(data.x),
          cy: yScale.scale(data.y),
          r: 10,
        });
      }
    );
  }

  constructor(
    private readonly dataStore: DataStore,
    private readonly layoutStore: LayoutStore
  ) {
    super({
      axis: {
        [DEFAULT_X_AXIS]: {
          plane: AxisPlane.X,
          scale: AxisScale.LINEAR,
          type: AxisType.CATEGORY,
        },
        [DEFAULT_Y_AXIS]: {
          plane: AxisPlane.Y,
          scale: AxisScale.LINEAR,
          type: AxisType.CATEGORY,
        },
      },
    });
  }
}
