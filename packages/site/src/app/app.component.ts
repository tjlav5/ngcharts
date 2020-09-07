import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = 'site';

  randomLines = [...new Array(200)].map((i) => {
    return [...new Array(20)].map((_, foo) => ({
      x: foo * 10,
      y: foo * Math.random() * 5,
    }));
  });

  constructor() {
    console.log(this.randomLines);
  }
}
