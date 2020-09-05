import { NgModule } from '@angular/core';
import {
  Chart,
  ChartPortal,
  Curve,
  XAxis,
  ChartResize,
  Line,
  ReferencePoint,
} from './chart';
import { CommonModule } from '@angular/common';

const EXPORTED_COMPONENTS = [
  Line,
  XAxis,
  Chart,
  ChartResize,
  ChartPortal,
  Curve,
  ReferencePoint,
];

@NgModule({
  imports: [CommonModule],
  exports: EXPORTED_COMPONENTS,
  declarations: EXPORTED_COMPONENTS,
})
export class ChartModule {}
