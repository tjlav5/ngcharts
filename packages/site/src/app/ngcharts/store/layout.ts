import { DataPoint } from '../types';
import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { map } from 'rxjs/operators';

export interface LayoutState {
  size: {
    width: number;
    height: number;
  };
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  direction: Direction;
}

export enum Direction {
  HORIZONTAL,
  VERTICAL,
}

@Injectable()
export class LayoutStore extends ComponentStore<LayoutState> {
  constructor() {
    super({
      size: {
        width: 0,
        height: 0,
      },
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
      direction: Direction.HORIZONTAL,
    });
  }

  readonly setSize = this.updater(
    (state, [width, height]: [number, number]) => ({
      ...state,
      size: {
        width,
        height,
      },
    })
  );

  size$ = this.select(this.state$, (state) => state.size);
  margins$ = this.select(this.state$, (state) => state.margins);

  viewBox$ = this.select(
    this.size$,
    ({ width, height }) => `0 0 ${width} ${height}`
  );

  requestSpace(direction: string, size: number) {
    this.setState((state) => ({
      ...state,
      margins: {
        ...state.margins,
        [direction]: state.margins[direction] + size,
      },
    }));

    return () => {
      this.relinquishSpace(direction, size);
    };
  }

  private relinquishSpace(direction: string, size: number) {
    this.setState((state) => ({
      ...state,
      margins: {
        ...state.margins,
        [direction]: state.margins[direction] - size,
      },
    }));
  }
}
