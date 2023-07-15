import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { MessageData } from 'src/app/firestore.datatypes';
import { MessagesService } from 'src/app/services/messages.service';

@Component({
  selector: 'app-chat-feed',
  templateUrl: './chat-feed.component.html',
  styleUrls: ['./chat-feed.component.css']
})
export class ChatFeedComponent implements OnInit {

  messageConversation: MessageData[] = [];

  /* subscriptions */
  private chatFeedMessagesSubjectSubscription: Subscription | null = null;

  constructor(private messagesService: MessagesService) {

    /* subscribe to the message conversatoin between both users */
    this.chatFeedMessagesSubjectSubscription = this.messagesService.chatFeedMessagesObservable.subscribe(
      (retrievedMessages: MessageData[]) => {
        this.messageConversation = retrievedMessages;
      }
    );

   }

  ngOnInit(): void {

  }

  ngOnDestroy() {
    this.clearSubscriptions();
  }

  private clearSubscriptions() {
    if (this.chatFeedMessagesSubjectSubscription != null) {
      this.chatFeedMessagesSubjectSubscription.unsubscribe();
      this.chatFeedMessagesSubjectSubscription = null;
    }
  }

}
