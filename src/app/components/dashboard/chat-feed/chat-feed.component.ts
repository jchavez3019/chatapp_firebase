import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { MessageData, UserData } from 'src/app/firestore.datatypes';
import { MessagesService } from 'src/app/services/messages.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-chat-feed',
  templateUrl: './chat-feed.component.html',
  styleUrls: ['./chat-feed.component.css']
})
export class ChatFeedComponent implements OnInit {

  private chatReceiverUser: UserData | null = null;
  currentConversationThread: MessageData[] = [];
  currUserEmail: string;

  /* subscriptions */
  private chatReceiverObservableSubscription: Subscription | null = null;
  private retrieveConversationsObservableSubscription: Subscription | null = null;

  constructor(private messagesService: MessagesService, private usersService: UserService) {

    this.currUserEmail = this.usersService.getCurrUserEmail();

    this.messagesService.beginRetreivingMessages();

    this.chatReceiverObservableSubscription = this.messagesService.chatReceiverObservable.subscribe(
      (otherUser: UserData | null) => {

        if (otherUser != null && this.chatReceiverUser != otherUser) {
          this.chatReceiverUser = otherUser;

          console.log("Chat feed received other user :" + otherUser.email);

          // const newMessageObservable = this.messagesService.retrieveConversationObservable(otherUser.email);
          // if (newMessageObservable != null) {
          //   this.currentConversationThread = [];
          //   this.retrieveConversationsObservableSubscription = newMessageObservable.subscribe(
          //     (newMessageData: MessageData[]) => {
          //       this.currentConversationThread.push(...newMessageData);
          //       console.log("Received new messages:\n " + this.currentConversationThread);
          //     }
          //   );
          // }

          /* attempting to grab list by reference */
          this.currentConversationThread = this.messagesService.retrieveChatsByReference(otherUser);

        }
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

    if (this.retrieveConversationsObservableSubscription != null) {
      this.retrieveConversationsObservableSubscription.unsubscribe();
      this.retrieveConversationsObservableSubscription = null;
    }
  }

}