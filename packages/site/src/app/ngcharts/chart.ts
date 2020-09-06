import { scaleLinear } from 'd3-scale';
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

@Directive({
  selector: 'chart-portal, g[chart-portal]',
})
export class ChartPortal {}

@Injectable()
export class LayoutService {
  private readonly margins$ = new BehaviorSubject({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  constructor(private readonly size$: NgResizeObserver) {}

  getPlaneSize() {
    combineLatest(this.margins$, this.size$).pipe(
      map(([margins, { width, height }]) => ({
        width: width - margins.left - margins.right,
        height: height,
      }))
    );
  }

  getPlane() {
    return combineLatest(this.margins$, this.size$).pipe(
      map(([margins, { width, height }]) => ({
        top: margins.top,
        bottom: height - margins.top - margins.bottom,
        left: margins.left,
        right: width - margins.left - margins.right,
      }))
    );
  }

  getSize() {
    return this.size$;
  }

  requestSpace(direction: string, size: number) {
    this.margins$.next({
      ...this.margins$.value,
      [direction]: this.margins$.value[direction] + size,
    });
    return () => this.relinquishSpace(direction, size);
  }

  private relinquishSpace(direction: string, size: number) {
    this.margins$.next({
      ...this.margins$.value,
      [direction]: this.margins$.value[direction] + size,
    });
  }
}

interface DataMap {
  [key: string]: {
    xAxisId: string;
    yAxisId: string;
    data: DataPoint[];
  };
}

@Injectable()
export class DataService {
  private readonly dataMap$ = new BehaviorSubject<DataMap>({});

  private getDataByAxis(axisId: string): Observable<number[]> {
    return this.dataMap$.pipe(
      map((dataMap) => {
        return Object.values(dataMap).map((d) => {
          if (d.xAxisId === axisId) {
            return d.data.map(({ x }) => x);
          } else if (d.yAxisId === axisId) {
            return d.data.map(({ y }) => y);
          } else {
            return [];
          }
        });
      }),
      map((allData: number[][]) => allData.flat())
    );
  }

  setData(key: string, data: DataPoint[], xAxisId = '', yAxisId = '') {
    this.dataMap$.next({
      ...this.dataMap$.value,
      [key]: {
        data,
        xAxisId,
        yAxisId,
      },
    });
  }

  deleteData(key: string) {
    const { [key]: _, ...everythingElse } = this.dataMap$.value;
    this.dataMap$.next(everythingElse);
  }

  getData(key: string) {
    return this.dataMap$.pipe(map((dataMap) => dataMap[key]?.data));
  }

  getExtents(axisId: string): Observable<[number, number]> {
    return this.getDataByAxis(axisId).pipe(
      map((data) => {
        let min = Infinity;
        let max = -Infinity;

        for (const d of data) {
          if (d < min) min = d;
          if (d > max) max = d;
        }

        return [min, max];
      })
    );
  }
}

@Injectable()
export class ChartService {
  /**
   * data-map ->
   * id: {xAxisId, yAxisId, data}
   */
  private readonly dataMap = new BehaviorSubject<{ [id: string]: DataPoint[] }>(
    {}
  );

  constructor(private readonly size$: NgResizeObserver) {}

  setData(key: string, data: DataPoint[], xAxisId = '', yAxisid = '') {
    this.dataMap.next({
      ...this.dataMap.value,
      [key]: data,
    });
  }

  getData(key: string) {
    return this.dataMap.pipe(map((dataMap) => dataMap[key]));
  }

  getExtents(axisId: string) {
    // todo replace getBounds
  }

  getBounds(): Observable<[number, number]> {
    return this.dataMap.pipe(
      map((dataMap) => Object.values(dataMap)),
      map((allDataPoints) => {
        let min = Infinity;
        let max = -Infinity;
        // return [0, 0];
        for (const dataPoints of allDataPoints) {
          for (const d of dataPoints) {
            if (d.x < min) {
              min = d.x;
            }
            if (d.x > max) {
              max = d.x;
            }
          }
        }
        return [min, max];
      })
    );
  }

  getXScale() {
    return combineLatest(this.getBounds(), this.size$).pipe(
      map(([bounds, size]) => {
        return scaleLinear().domain(bounds).range([0, size.width]);
      })
    );
    // return scaleLinear([]);
  }
}

@Component({
  selector: 'chart',
  providers: [ChartService, DataService, LayoutService],
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
  readonly foo$ = of({
    width: this.el.nativeElement.clientWidth,
    height: this.el.nativeElement.clientHeight,
  });

  readonly viewBox$ = merge(this.foo$, this.size$).pipe(
    map(({ width, height }) => `0 0 ${width} ${height}`),
    observeOn(animationFrameScheduler)
    // take(10)
  );

  constructor(
    // @Optional() chartResize: ResizeObserverService,
    private size$: NgResizeObserver,
    private el: ElementRef
  ) {}
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
  // foo$ = this.chartService.getBounds();
  private readonly xScale$ = combineLatest(
    this.dataService.getExtents('_x_'),
    this.layoutService.getSize()
  ).pipe(
    map(([extents, size]) => {
      return scaleLinear().domain(extents).range([0, size.width]);
    })
  );

  readonly foobar$ = this.xScale$.pipe(map((xScale) => xScale.ticks(4)));

  // readonly axisPath$ = this.
  readonly axisPath$ = combineLatest(
    this.xScale$,
    this.layoutService.getSize()
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
    this.xScale$,
    this.layoutService.getSize()
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
    private readonly dataService: DataService,
    private readonly layoutService: LayoutService,
    private sanitizer: DomSanitizer
  ) {
    this.relinquishSpace = this.layoutService.requestSpace('bottom', 20);
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

@Injectable()
export class ResizeObserverService {
  private onResizeSubject = new Subject();
  private resizeObserver: any;
  public onResize: Observable<{}> = this.onResizeSubject.asObservable();

  constructor(
    @Inject(RESIZE_OBSERVER) ResizeObserverCl: ResizeObserverClass,
    cdr: ChangeDetectorRef,
    ngZone: NgZone
  ) {
    this.resizeObserver = new ResizeObserverCl((entries) => {
      const entry = entries && entries[0];
      if (entry) {
        ngZone.run(() => {
          this.onResizeSubject.next(entry.contentRect);
        });
        // cdr.detectChanges();
      }
    });
  }

  observe(target: HTMLElement) {
    this.resizeObserver.observe(target);
  }

  unobserve(target: HTMLElement) {
    this.resizeObserver.unobserve(target);
  }
}

export function ngResizeObserverFactory(
  resizeObserverService: ResizeObserverService
) {
  return resizeObserverService.onResize;
}

class NgResizeObserver extends Observable<{ width: number; height: number }> {}

const NgResizeObserverProvider = {
  provide: NgResizeObserver,
  useFactory: ngResizeObserverFactory,
  deps: [ResizeObserverService],
};

@Directive({
  selector: '[render-on-resize]',
  providers: [ResizeObserverService, NgResizeObserverProvider],
})
export class ChartResize {
  constructor(
    private readonly resizeObserverService: ResizeObserverService,
    private readonly elRef: ElementRef
  ) {
    resizeObserverService.observe(elRef.nativeElement);
  }

  ngOnDestroy() {
    this.resizeObserverService.unobserve(this.elRef.nativeElement);
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

  private readonly xScale$ = combineLatest(
    this.dataService.getExtents('_x_'),
    this.layoutService.getSize()
  ).pipe(
    map(([extents, size]) => {
      return scaleLinear().domain(extents).range([0, size.width]);
    })
  );
  private readonly yScale$ = combineLatest(
    this.dataService.getExtents('_y_'),
    this.layoutService.getSize()
  ).pipe(
    map(([extents, size]) => {
      return scaleLinear().domain(extents).range([0, size.height]);
    })
  );

  readonly referencePoint$: Observable<CircleProps> = combineLatest(
    this.dataService.getData(this.id),
    this.xScale$,
    this.yScale$
  ).pipe(
    map(([[data], xScale, yScale]) => {
      return {
        ...data,
        x: xScale(data.x),
        y: yScale(data.y),
        r: 10,
      };
    })
  );

  @Input('referencePoint')
  set referencePoint(referencePoint: DataPoint) {
    this.dataService.setData(this.id, [referencePoint], '_x_', '_y_');
  }

  constructor(
    private readonly dataService: DataService,
    private readonly layoutService: LayoutService
  ) {}

  ngOnDestroy() {
    this.dataService.deleteData(this.id);
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

  private readonly xScale$ = combineLatest(
    this.dataService.getExtents('_x_'),
    this.layoutService.getPlane()
  ).pipe(
    map(([extents, plane]) => {
      return scaleLinear().domain(extents).range([plane.left, plane.right]);
    })
  );
  private readonly yScale$ = combineLatest(
    this.dataService.getExtents('_y_'),
    this.layoutService.getPlane()
  ).pipe(
    map(([extents, plane]) => {
      return scaleLinear().domain(extents).range([plane.top, plane.bottom]);
    })
  );

  readonly line$: Observable<LineProps> = combineLatest(
    this.dataService.getData(this.id),
    this.xScale$,
    this.yScale$
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
    this.dataService.setData(this.id, line, '_x_', '_y_');
  }

  constructor(
    private readonly dataService: DataService,
    private readonly layoutService: LayoutService
  ) {}

  ngOnDestroy() {
    this.dataService.deleteData(this.id);
  }
}
