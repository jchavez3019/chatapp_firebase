import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Subscription, filter } from 'rxjs';
import { MessageData, UserData } from 'src/app/firestore.datatypes';
import { MessagesService } from 'src/app/services/messages.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-chat-feed',
  templateUrl: './chat-feed.component.html',
  styleUrls: ['./chat-feed.component.css']
})
export class ChatFeedComponent implements OnInit {

  @ViewChild("chat_messages") chat_messages: ElementRef | null = null;

  private chatReceiverUser: UserData | null = null;
  private detachedFromBottom: boolean = false;
  private lastDate: string = "";
  currentConversationThread: MessageData[] = [];
  additionalMessages: MessageData[] = [];
  currUserEmail: string;

  /* subscriptions */
  private chatReceiverObservableSubscription: Subscription | null = null;
  private retrieveConversationsObservableSubscription: Subscription | null = null;
  private newChatObservableSubscription: Subscription | null = null;

  constructor(private messagesService: MessagesService, private usersService: UserService) {

    this.currUserEmail = this.usersService.getCurrUserEmail();

    this.messagesService.beginRetreivingMessages();

    this.chatReceiverObservableSubscription = this.messagesService.chatReceiverObservable.subscribe(
      (otherUser: UserData | null) => {

        if (otherUser != null && this.chatReceiverUser != otherUser) {
          this.chatReceiverUser = otherUser;

          // console.log("Chat feed received other user :" + otherUser.email);

          /* remove the additional messages since we have switched to a different user */
          this.additionalMessages = [];
          this.lastDate = "";

          /* attempting to grab list by reference */
          this.currentConversationThread = this.messagesService.retrieveChatsByReference(otherUser);

        }
      }
    );

    this.newChatObservableSubscription = this.messagesService.newChatSentObservable.subscribe((receiver: string) => {
      this.scrollDown();
    });

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

    if (this.newChatObservableSubscription != null) {
      this.newChatObservableSubscription.unsubscribe();
      this.newChatObservableSubscription = null;
    }
  }

  private scrollDown() {
    if (this.chat_messages != null) {
      this.chat_messages.nativeElement.scrollTop = this.chat_messages.nativeElement.scrollHeight;
    }
  }

  scrollHandler(event: any) {
    if (event === "top") {
      console.log("scrolled to top");

      /* retrieve additional messages */
      console.log("Using last date: " + this.lastDate);

      /* if no lastDate is set, use the oldest date from the currentConversationThread */
      if (this.lastDate === "") {
        this.lastDate = this.currentConversationThread[0].date;
      }

      this.messagesService.retriveChatsByDate(this.lastDate, <string>this.chatReceiverUser?.email)
      .then((retrievedMessages: MessageData[]) => {

        if (retrievedMessages.length != 0) {
          /* append the older messages and update the lastDate to be the oldest date */
          this.additionalMessages.push(...retrievedMessages);
          const lastIdx = this.additionalMessages.length - 1;
          this.lastDate = this.additionalMessages[lastIdx].date;
        }

      })
    }

    if (event === "bottom") {
      console.log("scrolled to bottom");
      this.detachedFromBottom = false;
    }

    if (event === "detached_from_bottom") {
      console.log("detached from bottom");
      this.detachedFromBottom = true;
    }
  }

}