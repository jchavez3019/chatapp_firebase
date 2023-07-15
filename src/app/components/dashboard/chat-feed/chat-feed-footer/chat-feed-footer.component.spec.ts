import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatFeedFooterComponent } from './chat-feed-footer.component';

describe('ChatFeedFooterComponent', () => {
  let component: ChatFeedFooterComponent;
  let fixture: ComponentFixture<ChatFeedFooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChatFeedFooterComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatFeedFooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
