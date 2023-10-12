import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Unsubscribe } from '@angular/fire/auth';
import { Subscription, filter } from 'rxjs';
import { MessageData, UserData } from 'src/app/firestore.datatypes';
import { FriendsService } from 'src/app/services/friends.service';
import { MessagesService } from 'src/app/services/messages.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-chat-feed',
  templateUrl: './chat-feed.component.html',
  styleUrls: ['./chat-feed.component.css']
})
export class ChatFeedComponent implements OnInit {

  @ViewChild("chat_messages") chat_messages: ElementRef | null = null;

  chatReceiverUser: UserData | null = null; // the other user to display and their messages
  private detachedFromBottom: boolean = false; // if the current user has scrolled above 
  private lastDate: string = ""; // the latest message date in the conversation
  private otherUserStatusUnsubscribe: Unsubscribe | null = null; // the status of all the current user's friends

  currentConversationThread: MessageData[] = []; // the conversation between the current user and other user
  additionalMessages: MessageData[] = []; // any new messages that need to be displayed since the chat has opend
  currUserEmail: string; // the email of the current user
  otherUserStatuses: Map<String, String> = new Map<String, String>(); // a map of all the other users and their online status
  
  /* subscriptions */
  private chatReceiverObservableSubscription: Subscription | null = null; 
  private retrieveConversationsObservableSubscription: Subscription | null = null; 
  private newChatObservableSubscription: Subscription | null = null; 
  private allFriendsSubjectSubscription: Subscription | null = null; // subscription to get all friends
  private RTFriendStatusUnsubscriptions: Unsubscribe[] = []; // individual subscriptions to user's real time status

  constructor(private messagesService: MessagesService, private usersService: UserService, private friendsService: FriendsService) {

    this.currUserEmail = this.usersService.getCurrUserEmail();

    /* start receiving messages from all friends */
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

          /* clear previous subscription if one exists */
          if (this.otherUserStatusUnsubscribe != null) {
            this.otherUserStatusUnsubscribe();
            this.otherUserStatusUnsubscribe = null;
          }

        }
      }
    );

    /* subscribe to received updated friend's list for the current user */
    this.allFriendsSubjectSubscription = this.friendsService.allFriendsObservable.subscribe((updatedFriends: UserData[]) => {

      /* check if their are any friends whose status you do not have and get listen for their status changes */
      let newFriends: UserData[] = [];
      updatedFriends.forEach((user: UserData) => {
        if (user != undefined && !this.otherUserStatuses.has(user.email)) {
          newFriends.push(user);
        }
      })

      /* if we have found new friends, get a subscription to their statuses and perform initial query */
      if (newFriends.length > 0) {
        /* subscription for modifications to status */
        this.RTFriendStatusUnsubscriptions.push(...this.usersService.getSnapshotFriendStatuses(newFriends, this._onUserStatusUpdate, this));

        /* getting initial status */
        this.usersService.getInitialFriendStatuses(newFriends, this._onUserStatusInit, this);
      }
      
    });

    /* scroll to the bottom of a conversation thread after switching to another conversation with another user */
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

    if (this.allFriendsSubjectSubscription != null) {
      this.allFriendsSubjectSubscription.unsubscribe();
      this.allFriendsSubjectSubscription = null;
    }

    this.RTFriendStatusUnsubscriptions.forEach((unsub: Unsubscribe) => {
      unsub();
    })
  }

  /*
  Description:
    Scrolls down to the bottom of a conversation thread upon switching between a conversation with 
    a different user.
  Inputs:
    None
  Outputs:
    None
  Returns:
    None
  Effects:
    Scrolls to the bottom of the conversation thread.
  */
  private scrollDown() {
    if (this.chat_messages != null) {
      this.chat_messages.nativeElement.scrollTop = this.chat_messages.nativeElement.scrollHeight;
    }
  }

  /*
  Description:
    Handles the current user's position in the conversation thread and loads in more messages 
    if necessary. 
  Inputs:
    event: any -- scroll event
  Outputs:
    None
  Returns:
    None
  Effects:
    Retrieves messages from Firestore if necessary
  */
  scrollHandler(event: any) {
    // console.log("Scroll handler received event " + event);

    if (event === "top") {
      // console.log("scrolled to top");

      /* retrieve additional messages */
      // console.log("Using last date: " + this.lastDate);

      /* if no lastDate is set, use the oldest date from the currentConversationThread */
      if (this.lastDate === "") {
        this.lastDate = this.currentConversationThread[0].date;
      }

      this.messagesService.retriveChatsByDate(this.lastDate, <string>this.chatReceiverUser?.email)
      .then((retrievedMessages: MessageData[]) => {

        // console.log("Resolved retrieving messages by date");

        if (retrievedMessages.length != 0) {
          /* append the older messages and update the lastDate to be the oldest date */
          this.additionalMessages.push(...retrievedMessages);
          const lastIdx = this.additionalMessages.length - 1;
          this.lastDate = this.additionalMessages[lastIdx].date;
        }

      })
      .catch((error: any) => console.error("Error retrieving chats by data"));
    }

    if (event === "bottom") {
      // console.log("scrolled to bottom");
      this.detachedFromBottom = false;
    }

    if (event === "detached_from_bottom") {
      // console.log("detached from bottom");
      this.detachedFromBottom = true;
    }
  }

  /* gets a user's initial online status */
  private _onUserStatusInit(email: String, status: String, ctx: any) {

    if (!ctx.otherUserStatuses.has(email)) {
      ctx.otherUserStatuses.set(email, status);
    }
    
  }

  /* updates the user's online status if it has been modified */
  private _onUserStatusUpdate(email: String, status: String, ctx: any) : void {
    ctx.otherUserStatuses.set(email, status);
  }

}