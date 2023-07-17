import { Injectable, inject } from '@angular/core';
import { Auth, Unsubscribe, User, onAuthStateChanged } from '@angular/fire/auth';
import { BehaviorSubject, Observable, Subject, Subscription, filter, map, tap } from 'rxjs';
import { MessageData, UserData, messageDataConverter } from '../firestore.datatypes';
import { DocumentChange, Firestore, FirestoreError, QueryDocumentSnapshot, QuerySnapshot, WriteBatch, and, collection, doc, getDoc, getDocs, onSnapshot, or, orderBy, query, where, writeBatch } from '@angular/fire/firestore';

import { ConversationInfo, convserationInfoConverter } from '../firestore.datatypes';
import { FriendsService } from './friends.service';

@Injectable({
  providedIn: 'root'
})
export class MessagesService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  /* private variables */
  private subscribedFriends: subscribedFriends_t[] = [];
  private pendingSubsriptions: string[] = [];

  /* private subjects */
  private showChatFeedSubject: BehaviorSubject<Boolean> = new BehaviorSubject<Boolean>(false);
  private chatFeedMessagesSubject: Subject<chatPair[]> = new Subject<chatPair[]>();
  private chatReceiverSubject: BehaviorSubject<UserData | null> = new BehaviorSubject<UserData | null>(null);

  /* public observables */
  showChatFeedObservable: Observable<Boolean> = this.showChatFeedSubject.asObservable();
  chatFeedMessagesObservable: Observable<chatPair[]> = this.chatFeedMessagesSubject.asObservable();
  chatReceiverObservable: Observable<UserData | null> = this.chatReceiverSubject.asObservable();

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
    this.chatFeedMessagesSubject.next([]);
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
            messageWriteBatch.set(doc(collection(this.firestore, `messages/${messagesDocumentId}/allMessages`)).withConverter(messageDataConverter), newMessageData);
          }
          else {
            messageWriteBatch.set(doc(collection(this.firestore, `messages/${messagesDocumentId}/allMessages`)).withConverter(messageDataConverter), newMessageData);
          }

          /* commit the changes */
          messageWriteBatch.commit()
          .then(() => resolve())
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
        else {
          let messagesDocumentId: string = convoInfo_snapshot.size === 0 ? doc(collection(this.firestore, "messages")).id : convoInfo_snapshot.docs[0].data()['conversationID'];
          const snapshotQuery = query(collection(this.firestore, `messages/${messagesDocumentId}/allMessages`).withConverter(messageDataConverter), orderBy("date"));
          const ret_snapshot = onSnapshot(snapshotQuery,
          (messages_snapshot: QuerySnapshot<MessageData>) => {
            let newMessages: chatPair[] = [];

            messages_snapshot.docChanges().forEach(
              (currMessage: DocumentChange<MessageData>) => {
                if (currMessage.type === 'added') {
                  const newChatPair: chatPair = {
                    "chatName": otherEmail,
                    "messageData": currMessage.doc.data()
                  }
                  newMessages.push(newChatPair);
                }
              }
            )

            /* publish the new chats if any exists */
            if (newMessages.length > 0)
              this.chatFeedMessagesSubject.next(newMessages);
          },
          (error: FirestoreError) => {
            console.error(error);
          });

          resolve(ret_snapshot);
        }
      })
      .catch((error: FirestoreError) => reject(error));
    });

  }

  retrieveChats(otherEmail: string) : Promise<MessageData[]> {
    const currUserEmail: string = <string>this.auth.currentUser?.email;

    return new Promise<MessageData[]>((resolve, reject) => {
      /* first need to check if ConversationInfo document exists between the two users */
      const conversationInfoQuery = query(collection(this.firestore, "conversations").withConverter(convserationInfoConverter), or(
        and(where("messenger1", "==", currUserEmail), where("messenger2", "==", otherEmail)), 
        and(where("messenger1", "==", otherEmail), where("messenger2", "==", currUserEmail))));

      getDocs(conversationInfoQuery)
      .then((convoInfoQuery_snapshot: QuerySnapshot<ConversationInfo>) => {
        
        if (convoInfoQuery_snapshot.size > 1) {
          reject("Multiple conversation documents exists between both users");
        }
        else if (convoInfoQuery_snapshot.size === 0) {
          resolve([]);
        }
        else {
          getDocs(collection(this.firestore, `messages/${convoInfoQuery_snapshot.docs[0].id}/allMessages`).withConverter(messageDataConverter))
          .then((messageData_snapshot: QuerySnapshot<MessageData>) => {
            let ret_messages: MessageData[] = [];

            messageData_snapshot.forEach((currMessage: QueryDocumentSnapshot<MessageData>) => {
              ret_messages.push(currMessage.data());
            });

            resolve(ret_messages);
          })
          .catch((error: FirestoreError) => reject(error));
        }
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
    // we will display the date as DD-MM-YYYY H:M:S

    return `${currentYear}-${currentMonth}-${currentDay} ${currentHour}:${currentMinute}:${currentSec}`;
  }


}

/* interfaces */
export interface chatPair {
  chatName: string;
  messageData: MessageData
}

interface subscribedFriends_t {
  friendEmail: string;
  onSnapshotUnsubscribe: Unsubscribe;
}