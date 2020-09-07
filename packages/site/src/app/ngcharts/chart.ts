import { scaleLinear } from 'd3-scale';
import { ComponentStore } from '@ngrx/component-store';
import { CartesianStore } from './store/cartesian';
import { curveLinear, line } from 'd3-shape';
import { axisBottom } from 'd3-axis';
import {
  Directive,
  Input,
  Injectable,
  Optional,
  InjectionToken,
  Inject,
  ElementRef,
  Host,
  HostBinding,
  TemplateRef,
  ViewContainerRef,
  ComponentFactoryResolver,
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import {
  BehaviorSubject,
  Subject,
  Observable,
  of,
  merge,
  animationFrameScheduler,
  combineLatest,
} from 'rxjs';
import { map, tap, shareReplay, take, observeOn } from 'rxjs/operators';
import { DomSanitizer } from '@angular/platform-browser';
import { LayoutStore } from './store/layout';
import { DataStore } from './store/data';
import { DataPoint } from './types';

@Component({
  selector: 'chart',
  providers: [CartesianStore, DataStore, LayoutStore],
  template: `<svg [attr.viewBox]="viewBox$ | async" style="display: block;">
    <ng-content></ng-content>
  </svg>`,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Chart {
  readonly viewBox$ = this.layoutStore.viewBox$;

  constructor(el: ElementRef, private readonly layoutStore: LayoutStore) {
    layoutStore.setSize([
      el.nativeElement.clientWidth,
      el.nativeElement.clientHeight,
    ]);
  }
}

@Component({
  selector: 'g[xAxis]',
  template: `<svg:path
      *ngIf="axisPath$ | async as axisPath"
      [attr.d]="axisPath.d"
      stroke="green"
    ></svg:path>
    <svg:g
      *ngFor="let tick of ticks$ | async"
      [style.transform]="tick.transform"
      [style.fill]="'blue'"
    >
      <svg:line stroke="currentColor" y2="6"></svg:line>
      <svg:text fill="currentColor" y="9" dy="0.71em">{{ tick.text }}</svg:text>
    </svg:g>`,
  host: {
    'text-anchor': 'middle',
  },
})
export class XAxis {
  // readonly axisPath$ = this.
  readonly axisPath$ = combineLatest(
    this.cartesianStore.getScaleByAxis('_x_', 'primary'),
    this.layoutStore.size$
  ).pipe(
    map(([xScale, size]) => {
      const lineGenerator = line()
        // .curve(curveLinear)
        .x(function (d) {
          return xScale(d[0]);
        })
        .y(function (d) {
          return size.height - 20;
        });
      return {
        d: lineGenerator([
          [0, 0],
          [500, 0],
        ]),
      };
    })
  );

  readonly ticks$ = combineLatest(
    this.cartesianStore.getScaleByAxis('_x_', 'primary'),
    this.layoutStore.size$
  ).pipe(
    observeOn(animationFrameScheduler),
    map(([xScale, size]) => {
      // transform x+y
      // text

      const ticks = xScale.ticks();
      //   console.log(ticks);
      const newTicks = ticks.map((t) => ({
        transform: this.sanitizer.bypassSecurityTrustStyle(
          `translate(${xScale(t)}px, ${size.height - 20}px)`
        ),
        text: `${t}`,
      }));
      //   console.log(newTicks);
      return newTicks;
    })
  );

  private readonly relinquishSpace: () => void;

  constructor(
    private sanitizer: DomSanitizer,
    private readonly dataStore: DataStore,
    private readonly layoutStore: LayoutStore,
    private readonly cartesianStore: CartesianStore
  ) {
    // this.relinquishSpace = this.layoutService.requestSpace('bottom', 20);
    this.relinquishSpace = layoutStore.requestSpace('bottom', 20);
  }

  ngOnDestroy() {
    this.relinquishSpace();
  }
}

interface CircleProps {
  cx: number;
  cy: number;
  r: number;
}

@Component({
  selector: 'g[referencePoint]',
  template: `<ng-container *ngIf="referencePoint$ | async as referencePoint">
    <svg:circle
      [attr.cx]="referencePoint.cx"
      [attr.cy]="referencePoint.cy"
      [attr.r]="referencePoint.r"
    ></svg:circle>
  </ng-container>`,
})
export class ReferencePoint {
  id = `${Math.random()}`;

  readonly referencePoint$: Observable<CircleProps> = combineLatest(
    this.dataStore.getData(this.id),
    this.cartesianStore.getPointGenerator('_x_', '_y_')
  ).pipe(map(([[data], pointGenerator]) => pointGenerator(data)));

  @Input('referencePoint')
  set referencePoint(referencePoint: DataPoint) {
    this.dataStore.addData({
      id: this.id,
      data: [referencePoint],
      xAxisId: '_x_',
      yAxisId: '_y_',
    });
  }

  constructor(
    private readonly cartesianStore: CartesianStore,
    private readonly dataStore: DataStore
  ) {}

  ngOnDestroy() {
    this.dataStore.deleteData(this.id);
  }
}

interface LineProps {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

@Component({
  selector: 'g[line]',
  template: `<ng-container *ngIf="line$ | async as line">
    <svg:line
      [attr.x1]="line.x1"
      [attr.x2]="line.x2"
      [attr.y1]="line.y1"
      [attr.y2]="line.y2"
      stroke="currentColor"
    ></svg:line>
  </ng-container>`,
})
export class Line {
  id = `${Math.random()}`;

  readonly line$: Observable<LineProps> = combineLatest(
    this.dataStore.getData(this.id),
    this.compositeStore.getLineGenerator('_x_', '_y_')
  ).pipe(map(([[data], lineGenerator]) => lineGenerator(data)));

  @Input('line')
  set line(line: Omit<DataPoint, 'x'> | Omit<DataPoint, 'y'>) {
    this.dataStore.addData({
      id: this.id,
      data: [
        {
          ...{
            x: null,
            y: null,
          },
          ...line,
        },
      ],
      xAxisId: '_x_',
      yAxisId: '_y_',
    });
  }

  constructor(
    private readonly dataStore: DataStore,
    private readonly compositeStore: CartesianStore
  ) {}

  ngOnDestroy() {
    this.dataStore.deleteData(this.id);
  }
}

interface PathProps {
  d: string;
}

@Component({
  selector: 'g[path]',
  template: `<ng-container *ngIf="path$ | async as path">
    <svg:path [attr.d]="path.d" stroke="currentColor" fill="none"></svg:path>
  </ng-container>`,
})
export class Path {
  id = `${Math.random()}`;

  readonly path$: Observable<PathProps> = combineLatest(
    this.dataStore.getData(this.id),
    this.compositeStore.getPathGenerator('_x_', '_y_')
  ).pipe(map(([data, pathGenerator]) => pathGenerator(data)));

  @Input('path')
  set path(path: DataPoint[]) {
    this.dataStore.addData({
      id: this.id,
      data: path,
      xAxisId: '_x_',
      yAxisId: '_y_',
    });
  }

  constructor(
    private readonly dataStore: DataStore,
    private readonly compositeStore: CartesianStore
  ) {}

  ngOnDestroy() {
    this.dataStore.deleteData(this.id);
  }
}
