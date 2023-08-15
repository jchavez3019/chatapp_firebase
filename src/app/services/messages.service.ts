import { Injectable, inject } from '@angular/core';
import { Auth, Unsubscribe, User, onAuthStateChanged } from '@angular/fire/auth';
import { BehaviorSubject, Observable, Subject, Subscription, combineLatest, filter, map, of, tap } from 'rxjs';
import { MessageData, UserData, messageDataConverter } from '../firestore.datatypes';
import { DocumentChange, Firestore, FirestoreError, QueryDocumentSnapshot, QuerySnapshot, WriteBatch, and, collection, addDoc, doc, getDoc, getDocs, onSnapshot, or, orderBy, limit, query, where, writeBatch, setDoc, startAfter, endBefore } from '@angular/fire/firestore';

import { ConversationInfo, convserationInfoConverter } from '../firestore.datatypes';
import { FriendsService } from './friends.service';

const MAXMESSAGES = 10;

@Injectable({
  providedIn: 'root'
})
export class MessagesService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  /* private variables */
  private subscribedFriends: subscribedFriends_t[] = [];
  private pendingSubsriptions: string[] = [];

  private messageConversations: conversationLog_t[] = [];


  /* private subjects */
  private showChatFeedSubject: BehaviorSubject<Boolean> = new BehaviorSubject<Boolean>(false);
  private chatReceiverSubject: BehaviorSubject<UserData | null> = new BehaviorSubject<UserData | null>(null);
  private newChatSentSubject: Subject<string> = new Subject();

  /* public observables */
  showChatFeedObservable: Observable<Boolean> = this.showChatFeedSubject.asObservable();
  chatReceiverObservable: Observable<UserData | null> = this.chatReceiverSubject.asObservable();
  newChatSentObservable: Observable<string> = this.newChatSentSubject.asObservable();

  /* subscriptions */
  private onAuthStateChangedUnsubcribe: Unsubscribe | null = null;
  private allFriendsObservableSubscription: Subscription | null = null;

  constructor(private friendsService: FriendsService) {
    this.onAuthStateChangedUnsubcribe = onAuthStateChanged(this.auth, (credential: User | null) => {
      if (credential) {
        /* perform initializations */
        this.initializeAll();
      } 
      else {
        /* user has signed out, clear global variables and emit null/false */
        this.resetFields();
      }
    });
   }

  ngOnDestroy() {
    this.clearSubscriptions();
    this.resetFields();
  }

  private initializeAll() {
  }

  private resetFields() {
    this.showChatFeedSubject.next(false);
    this.chatReceiverSubject.next(null);
    this.subscribedFriends = [];
  }

  private clearSubscriptions() {
    if (this.onAuthStateChangedUnsubcribe != null) {
      this.onAuthStateChangedUnsubcribe();
      this.onAuthStateChangedUnsubcribe = null;
    }

    if (this.allFriendsObservableSubscription != null) {
      this.allFriendsObservableSubscription.unsubscribe();
      this.allFriendsObservableSubscription = null;
    }

    /* unsubscribe to all friend snapshots */
    this.subscribedFriends.forEach(
      (subscribedFriend: subscribedFriends_t) => {
        subscribedFriend.onSnapshotUnsubscribe();
      }
    )
  }

  beginRetreivingMessages() {
    this.allFriendsObservableSubscription = this.friendsService.allFriendsObservable
    .pipe(
      tap(
        (newFriends: UserData[]) => console.log(`new friend emails: ${newFriends.map((friends) => friends.email)}`)
      ),
      map(
        (updatedFriends: UserData[]) => {

          /* filter out friends that have already been subscribed to or whose subscription is not pending */
          let newFriendsEmails: string[] = [];
          updatedFriends.forEach(
            (currFriend: UserData) => {
              if (!this.subscribedFriends.map((entry) => entry.friendEmail).includes(currFriend.email) && !this.pendingSubsriptions.includes(currFriend.email)) {
                this.pendingSubsriptions.push(currFriend.email);
                newFriendsEmails.push(currFriend.email);
              }
            }
          )
          return newFriendsEmails;
        }
      ),
      /* filter out empty lists meaning no new friend chat subscriptions need to be made */
      filter((newFriendsEmails: string[]) => {
        if (newFriendsEmails.length > 0)
          return true;
        else 
          return false;
      })
    )
    .subscribe(
      (newFriendsEmails: string[]) => {

        newFriendsEmails.forEach(
          (newFriendEmail: string) => {
            /* create a snapshot for each new friend */
            this.retriveChatsSnapshot(newFriendEmail)
            .then((snapshotUnsubscribe) => {

              /* save the snapshot's unsubscribe */
              const subscribedFriend: subscribedFriends_t = {
                "friendEmail": newFriendEmail,
                "onSnapshotUnsubscribe": snapshotUnsubscribe
              }

              /* push the subscription */
              this.subscribedFriends.push(subscribedFriend);

              /* remove friend from pending subscriptions */
              const idx = this.pendingSubsriptions.findIndex((email) => email === newFriendEmail);
              this.pendingSubsriptions.splice(idx, 1);

            })
            .catch((error) => console.error(error));
        })
      }
    )
  }

  retrieveChatsByReference(user: UserData | string) : MessageData[] {

    const otherUserEmail = typeof(user) === "string" ? user : user.email;

    const idx = this.messageConversations.findIndex((entry) => entry.chatName === otherUserEmail);

    if (idx === -1) {
      const newChatLog: conversationLog_t = {
        "chatName": otherUserEmail,
        "allMessages": []
      };

      const newIdx = this.messageConversations.length;
      this.messageConversations.push(newChatLog);
      return this.messageConversations[newIdx].allMessages;
    }
    else {
      return this.messageConversations[idx].allMessages;
    }

  }

  openchatFeed(otherUser: UserData) {
    this.showChatFeedSubject.next(true);
    this.chatReceiverSubject.next(otherUser);
  }

  sendChat(otherEmail: string, message: string) : Promise<void> {

    const currUserEmail: string = <string>this.auth.currentUser?.email;
    const currDate = this.getDate();
    const newMessageData: MessageData = {
      "message": message,
      "date": currDate,
      "senderEmail": currUserEmail
    };
  
    return new Promise<void>((resolve, reject) => {

      /* first need to check if ConversationInfo document exists between the two users */
      const conversationInfoQuery = query(collection(this.firestore, "conversations").withConverter(convserationInfoConverter), or(
        and(where("messenger1", "==", otherEmail), where("messenger2", "==", currUserEmail)), 
        and(where("messenger1", "==", currUserEmail), where("messenger2", "==", otherEmail))));

      getDocs(conversationInfoQuery)
        .then((convoInfoQuery_snapshot: QuerySnapshot<ConversationInfo>) => {

          /* batch for creating message document and potentially 'conversations' and 'messages' documents */
          let messageWriteBatch: WriteBatch = writeBatch(this.firestore); 

          /* get the 'messages' document ID if it exists or generate a new one */
          let messagesDocumentId: string = convoInfoQuery_snapshot.size === 0 ? doc(collection(this.firestore, "messages")).id : convoInfoQuery_snapshot.docs[0].data()['conversationID'];

          if (convoInfoQuery_snapshot.size > 1) {
            /* there should not be multiple conversation documents between two users */
            reject("Multiple conversation documents exists between both users");
          }

          if (convoInfoQuery_snapshot.size === 0) {
            /* There exists 1 or no 'conversations' document and 'allMessages' subcollection. WriteBatch.set will create these if necessary */
            messageWriteBatch.set(doc(collection(this.firestore, "conversations")).withConverter(convserationInfoConverter), {
              "conversationID": messagesDocumentId,
              "messenger1": currUserEmail,
              "messenger2": otherEmail
            });
          }

          /* add the message */
          messageWriteBatch.set(doc(collection(this.firestore, `messages/${messagesDocumentId}/allMessages`)).withConverter(messageDataConverter), newMessageData);


          /* commit the changes */
          messageWriteBatch.commit()
          .then(() => {
            this.newChatSentSubject.next(otherEmail);
            resolve()
          })
          .catch((error: FirestoreError) => reject(error));

        })
        .catch((error: FirestoreError) => reject(error));
    });

  }

  retriveChatsByDate(date: string, otherEmail: string) : Promise<MessageData[]> {

    return new Promise((resolve, reject) => {

      /* email of the current user */
      const currUserEmail: string = <string>this.auth.currentUser?.email;

      /* obtain "conversations" document between the current and other user */
      const conversationInfoQuery = query(collection(this.firestore, "conversations").withConverter(convserationInfoConverter), or(
        and(where("messenger1", "==", currUserEmail), where("messenger2", "==", otherEmail)), 
        and(where("messenger1", "==", otherEmail), where("messenger2", "==", currUserEmail))));

      getDocs(conversationInfoQuery)
      .then((convoInfo_snapshot: QuerySnapshot<ConversationInfo>) => {

        if (convoInfo_snapshot.size > 1) {
          reject(`There exists multiple conversation documents between the current user and ${otherEmail}`);
        }

        let messagesDocumentId: string = convoInfo_snapshot.docs[0].data()['conversationID'];

        const messagesQuery = query(collection(this.firestore, `messages/${messagesDocumentId}/allMessages`).withConverter(messageDataConverter), orderBy("date", "desc"), startAfter(date), limit(MAXMESSAGES));

        getDocs(messagesQuery)
        .then((messageInfo_snapshot: QuerySnapshot<MessageData>) => {

          let retrievedMessages: MessageData[] = [];

          messageInfo_snapshot.forEach((currMessage: QueryDocumentSnapshot<MessageData>) => {
            retrievedMessages.push(currMessage.data());
          });

          resolve(retrievedMessages);

        })
        .catch((error: FirestoreError) => reject(error));

      })
      .catch((error: FirestoreError) => reject(error));

      });

  }

  private retriveChatsSnapshot(otherEmail: string) : Promise<Unsubscribe> {

    return new Promise((resolve, reject) => {
      const currUserEmail: string = <string>this.auth.currentUser?.email;

      const conversationInfoQuery = query(collection(this.firestore, "conversations").withConverter(convserationInfoConverter), or(
        and(where("messenger1", "==", currUserEmail), where("messenger2", "==", otherEmail)), 
        and(where("messenger1", "==", otherEmail), where("messenger2", "==", currUserEmail))));

      getDocs(conversationInfoQuery)
      .then((convoInfo_snapshot: QuerySnapshot<ConversationInfo>) => {

        if (convoInfo_snapshot.size > 1) {
          reject(`There exists multiple conversation documents between the current user and ${otherEmail}`);
        }

        let messagesDocumentId: string;

        if (convoInfo_snapshot.size === 0) {
          /* need to create a "conversations" document */
          messagesDocumentId = doc(collection(this.firestore, "messages")).id;
          const newConversation: ConversationInfo = {
            "messenger1": currUserEmail,
            "messenger2": otherEmail,
            "conversationID": messagesDocumentId
          }
          setDoc(doc(this.firestore,`conversations/${messagesDocumentId}`), newConversation);
        }
        else {
          /* a conversations document does exist */
          messagesDocumentId = convoInfo_snapshot.docs[0].data()['conversationID'];
        }

        const snapshotQuery = query(collection(this.firestore, `messages/${messagesDocumentId}/allMessages`).withConverter(messageDataConverter), orderBy("date", "desc"), limit(MAXMESSAGES));
        const ret_snapshot = onSnapshot(snapshotQuery,
        (messages_snapshot: QuerySnapshot<MessageData>) => {

          let newMessages: MessageData[] = [];

          /* though the snapshot is in descending order, push the data in ascending order */
          for (let i = messages_snapshot.docChanges().length - 1; i >= 0; i--) {
            const currMessage: DocumentChange<MessageData> = messages_snapshot.docChanges()[i];

            if (currMessage.type === "added") {
              newMessages.push(currMessage.doc.data());
            }
          }

          /* append to the conversation log */
          const idx = this.messageConversations.findIndex((value: conversationLog_t) => value.chatName === otherEmail);
          if (idx === -1) {
            this.messageConversations.push({
              "chatName": otherEmail,
              "allMessages": newMessages
            });
          }
          else {
            this.messageConversations[idx].allMessages.push(...newMessages);
          }

        },
        (error: FirestoreError) => {
          console.error(error);
        });

        resolve(ret_snapshot);
      })
      .catch((error: FirestoreError) => reject(error));
    });

  }

  private getDate() : string {
    // Date object
    const date = new Date();

    let currentDay= String(date.getDate()).padStart(2, '0');
    let currentMonth = String(date.getMonth()+1).padStart(2,"0");
    let currentYear = date.getFullYear();
    let currentHour = date.getHours() < 10 ? '0' + date.getHours() : date.getHours();
    let currentMinute = date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes();
    let currentSec = date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds();

    /* FIX: should be year, month, then day */
    // we will display the date as YYYY-MM-DD H:M:S

    return `${currentYear}-${currentMonth}-${currentDay} ${currentHour}:${currentMinute}:${currentSec}`;
  }


}

/* interfaces */
interface subscribedFriends_t {
  friendEmail: string;
  onSnapshotUnsubscribe: Unsubscribe;
}

interface conversationLog_t {
  "chatName": string;
  "allMessages": MessageData[];
}