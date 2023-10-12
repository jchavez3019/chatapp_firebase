import { Directive, HostListener, EventEmitter, Output, ElementRef } from '@angular/core';

const DISPLAY_LOGS = false; // displays information about the scrolling directive for debugging purposes

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
        this.detachedFromBottom = false;
        if (DISPLAY_LOGS) {console.log(`top: ${top}, Height: ${height}, offset: ${offset}`)};
      }
      else if (this.detachedFromBottom === false) {
        this.detachedFromBottom = true;
        this.scrollPosition.emit("detached_from_bottom");
        if (DISPLAY_LOGS) {console.log(`detached from bottom: top: ${top}, Height: ${height}, offset: ${offset}`)};
      }

      // emit top event
      if (top <= -height + offset + 1) {
        this.scrollPosition.emit('top');
        if (DISPLAY_LOGS) {console.log(`top: ${top}, Height: ${height}, offset: ${offset}`)};
      }
    }
    catch (err) { console.error("Error in ScrollDirective: " + err); }
  
}

}
