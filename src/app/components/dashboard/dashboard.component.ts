import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { MessagesService } from 'src/app/services/messages.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  /* global variables */
  showChatFeed: Boolean = false;

  /* subscriptions */
  private showChatFeedObservableSubscription: Subscription | null = null;

  constructor(private messagesService: MessagesService) {
    this.showChatFeedObservableSubscription = this.messagesService.showChatFeedObservable.subscribe((isChatOpen: Boolean) => {
      this.showChatFeed = isChatOpen;
    });
   }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.clearSubscriptions();
  }

  private clearSubscriptions() {
    if (this.showChatFeedObservableSubscription != null) {
      this.showChatFeedObservableSubscription.unsubscribe();
      this.showChatFeedObservableSubscription = null;
    }
  }

}
