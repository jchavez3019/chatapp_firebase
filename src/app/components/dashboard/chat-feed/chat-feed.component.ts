import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { MessageData, UserData } from 'src/app/firestore.datatypes';
import { MessagesService, chatPair } from 'src/app/services/messages.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-chat-feed',
  templateUrl: './chat-feed.component.html',
  styleUrls: ['./chat-feed.component.css']
})
export class ChatFeedComponent implements OnInit {

  private chatReceiverUser: UserData | null = null;
  private messageConversations: conversationLog_t[] = [];
  currentConversationThread: MessageData[] = [];
  currUserEmail: string;

  /* subscriptions */
  private chatFeedMessagesSubjectSubscription: Subscription | null = null;
  private chatReceiverObservableSubscription: Subscription | null = null;

  constructor(private messagesService: MessagesService, private usersService: UserService) {

    this.currUserEmail = this.usersService.getCurrUserEmail();

    this.chatReceiverObservableSubscription = this.messagesService.chatReceiverObservable.subscribe(
      (otherUser: UserData | null) => {
        this.chatReceiverUser = otherUser;
        if (otherUser != null) {
          const idx = this.messageConversations.findIndex((entry) => entry.chatName === otherUser.email);
          if (idx != -1) {
            this.currentConversationThread = this.messageConversations[idx].allMessages;
          }
        }
      }
    );

    /* listen to incoming batches of new chats */
    this.chatFeedMessagesSubjectSubscription = this.messagesService.chatFeedMessagesObservable.subscribe(
      (retrievedMessages: chatPair[]) => {

        retrievedMessages.forEach(
          (currChatPair: chatPair) => {

            const idx = this.messageConversations.findIndex((convoLog: conversationLog_t) => convoLog.chatName === currChatPair.chatName);
            if (idx === -1) {
              /* if a conversation log does not exist between the user and this friend, create one */
              const newConvoLog: conversationLog_t = {
                "chatName": currChatPair.chatName,
                "allMessages": [currChatPair.messageData]
              }
              this.messageConversations.push(newConvoLog);
            }
            else {
              /* append the new messages into the conversation log between the user and this friend */
              this.messageConversations[idx].allMessages.push(currChatPair.messageData);
            }

          }
        );

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
