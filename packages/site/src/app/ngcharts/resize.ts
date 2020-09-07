import {
  InjectionToken,
  Directive,
  ElementRef,
  NgZone,
  Inject,
} from '@angular/core';
import { LayoutStore } from './store/layout';

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
    layoutStore: LayoutStore,
    ngZone: NgZone,
    @Inject(RESIZE_OBSERVER) ResizeObserverCl: ResizeObserverClass
  ) {
    this.resizeObserver = new ResizeObserverCl((entries) => {
      const entry = entries && entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        ngZone.run(() => {
          layoutStore.setSize([width, height]);
        });
      }
    });

    this.resizeObserver.observe(elRef.nativeElement);
  }

  ngOnDestroy() {
    this.resizeObserver.unobserve(this.elRef.nativeElement);
  }
}
