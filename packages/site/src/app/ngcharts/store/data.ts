import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { DataPoint, AxisId, DataValue } from '../types';
import { Observable } from 'rxjs';

interface DataState {
  data: {
    [key: string]: {
      xAxisId: AxisId;
      yAxisId: AxisId;
      data: DataPoint[];
    };
  };
}

interface AddData {
  id: AxisId;
  data: DataPoint[];
  xAxisId: string;
  yAxisId: string;
}

@Injectable()
export class DataStore extends ComponentStore<DataState> {
  constructor() {
    super({ data: {} });
  }

  private allData$ = this.select(this.state$, (state) => state.data, {
    debounce: true,
  });

  readonly addData = this.updater((state, payload: AddData) => {
    return {
      ...state,
      data: {
        ...state.data,
        [payload.id]: {
          data: payload.data,
          xAxisId: payload.xAxisId,
          yAxisId: payload.yAxisId,
        },
      },
    };
  });

  readonly deleteData = this.updater((state, id: string) => {
    const { [id]: remove, ...keep } = state.data;
    return {
      ...state,
      data: keep,
    };
  });

  getDataByAxis<R = DataValue>(axisId: string) {
    return this.select(this.allData$, (allData) => {
      return Object.values(allData).flatMap((data) => {
        if (data.xAxisId === axisId) {
          return data.data.map((d) => (d.x as unknown) as R);
        } else if (data.yAxisId === axisId) {
          return data.data.map((d) => (d.y as unknown) as R);
        } else {
          return [] as R[];
        }
      });
    });
  }

  getExtentsByAxis(axisId: string) {
    return this.select(this.getDataByAxis(axisId), (data) => {
      let min = Infinity;
      let max = -Infinity;

      for (const d of data as number[]) {
        if (d < min) min = d;
        if (d > max) max = d;
      }

      return [min, max];
    });
  }

  getData(id: string): Observable<DataPoint[]> {
    return this.select(this.allData$, (allData) => allData[id]?.data || []);
  }
}
