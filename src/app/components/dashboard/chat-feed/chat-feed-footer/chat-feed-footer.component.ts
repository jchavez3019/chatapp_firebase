import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { MessageData, UserData } from 'src/app/firestore.datatypes';
import { MessagesService } from 'src/app/services/messages.service';

@Component({
  selector: 'app-chat-feed-footer',
  templateUrl: './chat-feed-footer.component.html',
  styleUrls: ['./chat-feed-footer.component.css']
})
export class ChatFeedFooterComponent implements OnInit {

  newmessage: string = "";

  private chatReceiverUser: UserData | null = null;

  /* subscriptions */
  private chatReceiverObservableSubscription: Subscription | null = null;

  constructor(private messagesService: MessagesService) { 
    this.chatReceiverObservableSubscription = this.messagesService.chatReceiverObservable.subscribe(
      (otherUser: UserData | null) => {
        this.chatReceiverUser = otherUser;
      }
    );
  }

  ngOnInit(): void {
  }

  ngOnDestroy() {
    this.clearSubscriptions();
  }

  private clearSubscriptions() {
    if (this.chatReceiverObservableSubscription != null) {
      this.chatReceiverObservableSubscription.unsubscribe();
      this.chatReceiverObservableSubscription = null;
    }
  }

  addMessage() {
    if (this.chatReceiverUser != null && this.newmessage != "") {
      this.messagesService.sendChat(this.chatReceiverUser.email, this.newmessage);
      this.newmessage = "";
    }
  }

}
