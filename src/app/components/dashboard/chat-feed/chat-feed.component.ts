import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { MessageData } from 'src/app/firestore.datatypes';
import { MessagesService, chatPair } from 'src/app/services/messages.service';

@Component({
  selector: 'app-chat-feed',
  templateUrl: './chat-feed.component.html',
  styleUrls: ['./chat-feed.component.css']
})
export class ChatFeedComponent implements OnInit {

  messageConversations: conversationLog_t[] = [];

  /* subscriptions */
  private chatFeedMessagesSubjectSubscription: Subscription | null = null;

  constructor(private messagesService: MessagesService) {

    /* subscribe to the message conversatoin between both users */
    this.chatFeedMessagesSubjectSubscription = this.messagesService.chatFeedMessagesObservable.subscribe(
      (retrievedMessages: chatPair[]) => {

        retrievedMessages.forEach(
          (currChatPair: chatPair) => {
            const idx = this.messageConversations.findIndex((convoLog: conversationLog_t) => convoLog.chatName === currChatPair.chatName);
            if (idx === -1) {
              const newConvoLog: conversationLog_t = {
                "chatName": currChatPair.chatName,
                "allMessages": [currChatPair.messageData]
              }
              this.messageConversations.push(newConvoLog);
            }
            else {
              this.messageConversations[idx].allMessages.push(currChatPair.messageData);
            }
          }
        )

        /* test viewing all convo logs */
        console.log(this.messageConversations);

      }
    );

    /* ready to start subscribing to messages */
    this.messagesService.beginRetreivingMessages();

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

/* interfaces */
interface conversationLog_t {
  "chatName": string;
  "allMessages": MessageData[];
}
