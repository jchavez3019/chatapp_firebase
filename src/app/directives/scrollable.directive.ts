import { Directive, HostListener, EventEmitter, Output, ElementRef } from '@angular/core';

@Directive({
  selector: '[appScrollable]'
})
export class ScrollableDirective {

  private detachedFromBottom = false;

  @Output() scrollPosition = new EventEmitter();

  constructor(public el: ElementRef) { }

  @HostListener('scroll', ['$event'])
  onScroll(event: any) {
    try {
      const top = event.target.scrollTop;
      const height = this.el.nativeElement.scrollHeight;
      const offset = this.el.nativeElement.offsetHeight;

      // emit bottom event
      if (top === 0) {
        this.scrollPosition.emit('bottom');
        console.log(`top: ${top}, Height: ${height}, offset: ${offset}`);
        this.detachedFromBottom = false;
      }
      else if (this.detachedFromBottom === false) {
        this.detachedFromBottom = true;
        this.scrollPosition.emit("detached_from_bottom");
        console.log(`detached from bottom: top: ${top}, Height: ${height}, offset: ${offset}`);
      }

      // emit top event
      if (top <= -height + offset) {
        this.scrollPosition.emit('top');
        console.log(`top: ${top}, Height: ${height}, offset: ${offset}`);
      }
    }
    catch (err) { console.error("Error in ScrollDirective: " + err); }
  }

}
