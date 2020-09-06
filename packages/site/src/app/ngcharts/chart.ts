import { scaleLinear } from 'd3-scale';
import { ComponentStore } from '@ngrx/component-store';
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

interface DataPoint {
  x: number;
  y: number;
}

export interface ChartState {
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
  data: {
    [key: string]: {
      xAxisId: string;
      yAxisId: string;
      data: DataPoint[];
    };
  };
}

interface AddData {
  id: string;
  data: DataPoint[];
  xAxisId: string;
  yAxisId: string;
}

@Injectable()
export class ChartStore extends ComponentStore<ChartState> {
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
      data: {},
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

  private allData$ = this.select(this.state$, (state) => state.data);
  size$ = this.select(this.state$, (state) => state.size);
  private margins$ = this.select(this.state$, (state) => state.margins);

  private getDataByAxis(axisId: string) {
    return this.select(this.allData$, (allData) => {
      return Object.values(allData).flatMap((data) => {
        if (data.xAxisId === axisId) {
          return data.data.map((d) => d.x);
        } else if (data.yAxisId === axisId) {
          return data.data.map((d) => d.y);
        } else {
          return [];
        }
      });
    });
  }

  private getExtentsByAxis(axisId: string) {
    return this.select(this.getDataByAxis(axisId), (data) => {
      let min = Infinity;
      let max = -Infinity;

      for (const d of data) {
        if (d < min) min = d;
        if (d > max) max = d;
      }

      return [min, max];
    });
  }

  getScaleByAxis(axisId: string, direction: string) {
    return this.select(
      this.size$,
      this.margins$,
      this.getExtentsByAxis(axisId),
      ({ width, height }, margins, extents) => {
        if (direction === 'primary') {
          return scaleLinear()
            .domain(extents)
            .range([margins.left, width - margins.left - margins.right]);
        } else {
          console.log(extents, margins.top, margins.bottom, height);
          return scaleLinear()
            .domain(extents)
            .range([margins.top, height - margins.top - margins.bottom]);
        }
      }
    );
  }

  getData(id: string): Observable<DataPoint[]> {
    return this.select(this.allData$, (allData) => allData[id]?.data || []);
  }

  requestSpace(direction: string, size: number) {
    this.setState((state) => ({
      ...state,
      margins: {
        ...state.margins,
        [direction]: state.margins[direction] + size,
      },
    }));
    return () => this.relinquishSpace(direction, size);
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

interface DataMap {
  [key: string]: {
    xAxisId: string;
    yAxisId: string;
    data: DataPoint[];
  };
}

@Component({
  selector: 'chart',
  providers: [ChartStore],
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
  // @HostBinding('style') foo = 'width: 100%; display: block;';
  // private readonly fooSize$ = of({
  //     width: this.el.nativeElement.
  // })
  /**
   * Escape hatch if you need to render _a lot_ of series at once, and are not lazy-loading
   * TODO: add companion components for lines/etc that takes in the KEY instead of the DATA
   */
  @Input()
  set data(allData: AddData[]) {
    for (const data of allData) {
      this.chartStore.addData(data);
    }
  }

  readonly foo$ = of({
    width: this.el.nativeElement.clientWidth,
    height: this.el.nativeElement.clientHeight,
  });

  readonly viewBox$ = merge(this.foo$, this.chartStore.size$).pipe(
    map(({ width, height }) => `0 0 ${width} ${height}`),
    observeOn(animationFrameScheduler)
    // take(10)
  );

  constructor(
    // @Optional() chartResize: ResizeObserverService,
    // private size$: NgResizeObserver,
    private el: ElementRef,
    private readonly chartStore: ChartStore
  ) {
    chartStore.setSize([
      el.nativeElement.clientWidth,
      el.nativeElement.clientHeight,
    ]);

    chartStore.state$.subscribe(console.log);
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
    this.chartStore.getScaleByAxis('_x_', 'primary'),
    this.chartStore.size$
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
    this.chartStore.getScaleByAxis('_x_', 'primary'),
    this.chartStore.size$
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
    private readonly chartStore: ChartStore
  ) {
    // this.relinquishSpace = this.layoutService.requestSpace('bottom', 20);
    this.relinquishSpace = chartStore.requestSpace('bottom', 20);
  }

  ngOnDestroy() {
    this.relinquishSpace();
  }
}

interface WindowWithResizeObserver extends Window {
  ResizeObserver?: any;
}

type ResizeObserverClass = {
  new (callback: (entries: any[]) => void): any;
};

export const RESIZE_OBSERVER = new InjectionToken<ResizeObserverClass>(
  'Resize Observer',
  {
    providedIn: 'root',
    factory: () => (window as WindowWithResizeObserver).ResizeObserver || null,
  }
);

@Directive({
  selector: 'chart[render-on-resize]',
})
export class ChartResize {
  private resizeObserver: any;

  constructor(
    private readonly elRef: ElementRef,
    chartStore: ChartStore,
    ngZone: NgZone,
    @Inject(RESIZE_OBSERVER) ResizeObserverCl: ResizeObserverClass
  ) {
    this.resizeObserver = new ResizeObserverCl((entries) => {
      const entry = entries && entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        console.log(width, height);
        ngZone.run(() => {
          chartStore.setSize([width, height]);
        });
      }
    });

    this.resizeObserver.observe(elRef.nativeElement);
  }

  ngOnDestroy() {
    this.resizeObserver.unobserve(this.elRef.nativeElement);
  }
}

interface CircleProps extends DataPoint {
  r: number;
}

@Component({
  selector: 'g[referencePoint]',
  template: `<ng-container *ngIf="referencePoint$ | async as referencePoint">
    <svg:circle
      [attr.cx]="referencePoint.x"
      [attr.cy]="referencePoint.y"
      [attr.r]="referencePoint.r"
    ></svg:circle>
  </ng-container>`,
})
export class ReferencePoint {
  id = `${Math.random()}`;

  readonly referencePoint$: Observable<CircleProps> = combineLatest(
    this.chartStore.getData(this.id),
    this.chartStore.getScaleByAxis('_x_', 'primary'),
    this.chartStore.getScaleByAxis('_y_', 'secondary')
  ).pipe(
    map(([[data], xScale, yScale]) => {
      return {
        x: xScale(data.x),
        y: yScale(data.y),
        r: 10,
      };
    })
  );

  @Input('referencePoint')
  set referencePoint(referencePoint: DataPoint) {
    this.chartStore.addData({
      id: this.id,
      data: [referencePoint],
      xAxisId: '_x_',
      yAxisId: '_y_',
    });
  }

  constructor(private readonly chartStore: ChartStore) {}

  ngOnDestroy() {
    // this.dataService.deleteData(this.id);
  }
}

interface LineProps {
  d: string;
}

@Component({
  selector: 'g[line]',
  template: `<ng-container *ngIf="line$ | async as line">
    <svg:path [attr.d]="line.d" stroke="currentColor" fill="none"></svg:path>
  </ng-container>`,
})
export class Line {
  id = `${Math.random()}`;

  readonly line$: Observable<LineProps> = combineLatest(
    this.chartStore.getData(this.id),
    this.chartStore.getScaleByAxis('_x_', 'primary'),
    this.chartStore.getScaleByAxis('_y_', 'secondary')
  ).pipe(
    map(([data, xScale, yScale]) => {
      const lineGenerator = line()
        .curve(curveLinear)
        .x(function (d) {
          return xScale(d[0]);
        })
        .y(function (d) {
          return yScale(d[1]);
        });
      return {
        d: lineGenerator(data.map((d) => [d.x, d.y])),
      };
    })
  );

  @Input('line')
  set line(line: DataPoint[]) {
    this.chartStore.addData({
      id: this.id,
      data: line,
      xAxisId: '_x_',
      yAxisId: '_y_',
    });
  }

  constructor(private readonly chartStore: ChartStore) {}

  ngOnDestroy() {
    // this.dataService.deleteData(this.id);
  }
}
