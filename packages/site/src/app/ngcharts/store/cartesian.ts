import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { LayoutStore } from './layout';
import { curveLinear, line } from 'd3-shape';
import { DataStore } from './data';
import { scaleLinear } from 'd3-scale';
import { DataPoint } from '../types';
import { Observable } from 'rxjs';

@Injectable()
export class CartesianStore extends ComponentStore<{}> {
  getScaleByAxis(axisId: string, direction: string) {
    return this.select(
      this.layoutStore.size$,
      this.layoutStore.margins$,
      this.dataStore.getExtentsByAxis(axisId),
      ({ width, height }, margins, extents) => {
        if (direction === 'primary') {
          return scaleLinear()
            .domain(extents)
            .range([margins.left, width - margins.left - margins.right]);
        } else {
          return scaleLinear()
            .domain(extents)
            .range([height - margins.top - margins.bottom, margins.top]);
        }
      }
    );
  }

  getLineGenerator(primaryAxisId: string, secondaryAxisId: string) {
    return this.select(
      this.getScaleByAxis(primaryAxisId, 'primary'),
      this.getScaleByAxis(secondaryAxisId, 'secondary'),
      (xScale, yScale) => {
        return (dataPoint: DataPoint) => {
          console.log(dataPoint);
          if (dataPoint.y === null) {
            const [min, max] = yScale.range();
            return {
              x1: xScale(dataPoint.x),
              x2: xScale(dataPoint.x),
              y1: min,
              y2: max,
            };
          }
          const [min, max] = xScale.range();
          return {
            x1: min,
            x2: max,
            y1: yScale(dataPoint.y),
            y2: yScale(dataPoint.y),
          };
        };
      }
    );
  }

  getPathGenerator(
    primaryAxisId: string,
    secondaryAxisId: string
  ): Observable<(dataPoints: DataPoint[]) => { d: string }> {
    return this.select(
      this.getScaleByAxis(primaryAxisId, 'primary'),
      this.getScaleByAxis(secondaryAxisId, 'secondary'),
      (xScale, yScale) => {
        return (dataPoints: DataPoint[]) => ({
          d: line()
            .curve(curveLinear)
            .x((d) => xScale(d[0]))
            .y((d) => yScale(d[1]))(dataPoints.map((d) => [d.x, d.y])),
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
      this.getScaleByAxis(primaryAxisId, 'primary'),
      this.getScaleByAxis(secondaryAxisId, 'secondary'),
      (xScale, yScale) => {
        return (data: DataPoint) => ({
          cx: xScale(data.x),
          cy: yScale(data.y),
          r: 10,
        });
      }
    );
  }

  constructor(
    private readonly dataStore: DataStore,
    private readonly layoutStore: LayoutStore
  ) {
    super({});
  }
}
