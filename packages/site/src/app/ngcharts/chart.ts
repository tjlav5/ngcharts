import { scaleLinear } from 'd3-scale';
import { ComponentStore } from '@ngrx/component-store';
import {
  CartesianStore,
  DEFAULT_X_AXIS,
  DEFAULT_Y_AXIS,
} from './store/cartesian';
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

  constructor(
    el: ElementRef,
    private readonly layoutStore: LayoutStore,
    dataStore: DataStore,
    cartesianStore: CartesianStore
  ) {
    layoutStore.setSize([
      el.nativeElement.clientWidth,
      el.nativeElement.clientHeight,
    ]);

    // dataStore.state$.subscribe(console.log)
    cartesianStore.state$.subscribe(console.log);
  }
}

@Component({
  selector: 'g[yAxis]',
  template: ` <svg:g [line]="{ x: 0 }" />
    <svg:g
      *ngFor="let tick of ticks$ | async"
      [style.transform]="tick.transform"
      [style.fill]="'blue'"
    >
      <svg:line stroke="currentColor" y2="6"></svg:line>
      <svg:line
        width="60"
        height="243.703125"
        x="20"
        y="5"
        stroke="#666"
        fill="none"
        x1="74"
        y1="65.92578125"
        x2="80"
        y2="65.92578125"
      ></svg:line>
      <svg:text fill="currentColor" y="9" dy="0.71em">{{ tick.text }}</svg:text>
    </svg:g>`,
  host: {
    'text-anchor': 'middle',
  },
})
export class YAxis {
  axisId = DEFAULT_Y_AXIS;
  width = 60;

  readonly ticks$ = combineLatest(
    this.cartesianStore.getScaleByAxis(this.axisId),
    this.layoutStore.size$
  ).pipe(
    observeOn(animationFrameScheduler),
    map(([yScale, size]) => {
      const newTicks = yScale.ticks.map((t: string | number) => ({
        transform: this.sanitizer.bypassSecurityTrustStyle(
          `translate(0px, ${yScale.scale(t)}px)`
        ),
        // Don't neet xScale... really need layoutStore to return the range for the plane
        // x1: xScale.scale(0) - this.width,
        text: `${t}`,
      }));
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
    this.relinquishSpace = layoutStore.requestSpace('left', 60);
  }

  ngOnDestroy() {
    this.relinquishSpace();
  }
}

@Component({
  selector: 'g[xAxis]',
  template: ` <svg:g [line]="{ y: 0 }" />
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
  axisId = DEFAULT_X_AXIS;

  readonly ticks$ = combineLatest(
    this.cartesianStore.getScaleByAxis(this.axisId),
    this.layoutStore.size$
  ).pipe(
    observeOn(animationFrameScheduler),
    map(([xScale, size]) => {
      const newTicks = xScale.ticks.map((t: string | number) => ({
        transform: this.sanitizer.bypassSecurityTrustStyle(
          `translate(${xScale.scale(t)}px, ${size.height - 20}px)`
        ),
        text: `${t}`,
      }));
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
  xAxisId = DEFAULT_X_AXIS;
  yAxisId = DEFAULT_Y_AXIS;

  readonly referencePoint$: Observable<CircleProps> = combineLatest(
    this.dataStore.getData(this.id),
    this.cartesianStore.getPointGenerator(this.xAxisId, this.yAxisId)
  ).pipe(map(([[data], pointGenerator]) => pointGenerator(data)));

  @Input('referencePoint')
  set referencePoint(referencePoint: DataPoint) {
    this.dataStore.addData({
      id: this.id,
      data: [referencePoint],
      xAxisId: this.xAxisId,
      yAxisId: this.yAxisId,
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
  xAxisId = DEFAULT_X_AXIS;
  yAxisId = DEFAULT_Y_AXIS;

  readonly line$: Observable<LineProps> = combineLatest(
    this.dataStore.getData(this.id),
    this.compositeStore.getLineGenerator(this.xAxisId, this.yAxisId)
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
      xAxisId: this.xAxisId,
      yAxisId: this.yAxisId,
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

  xAxisId = DEFAULT_X_AXIS;
  yAxisId = DEFAULT_Y_AXIS;

  readonly path$: Observable<PathProps> = combineLatest(
    this.dataStore.getData(this.id),
    this.compositeStore.getPathGenerator(this.xAxisId, this.yAxisId)
  ).pipe(map(([data, pathGenerator]) => pathGenerator(data)));

  @Input('path')
  set path(path: DataPoint[]) {
    this.dataStore.addData({
      id: this.id,
      data: path,
      xAxisId: this.xAxisId,
      yAxisId: this.yAxisId,
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
