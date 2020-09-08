import { NgModule } from '@angular/core';
import { Chart, XAxis, Path, ReferencePoint, Line, YAxis } from './chart';
import { CommonModule } from '@angular/common';
import { ChartResize } from './resize';

const EXPORTED_COMPONENTS = [
  ChartResize,
  Path,
  XAxis,
  YAxis,
  Chart,
  ChartResize,
  ReferencePoint,
  Line,
];

@NgModule({
  imports: [CommonModule],
  exports: EXPORTED_COMPONENTS,
  declarations: EXPORTED_COMPONENTS,
})
export class ChartModule {}
