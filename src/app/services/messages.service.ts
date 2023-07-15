import { Injectable, inject } from '@angular/core';
import { Auth, Unsubscribe, User, onAuthStateChanged } from '@angular/fire/auth';
import { BehaviorSubject, Observable } from 'rxjs';
import { MessageData, UserData, messageDataConverter } from '../firestore.datatypes';
import { Firestore, FirestoreError, QueryDocumentSnapshot, QuerySnapshot, WriteBatch, and, collection, doc, getDoc, getDocs, or, query, where, writeBatch } from '@angular/fire/firestore';

import { ConversationInfo, convserationInfoConverter } from '../firestore.datatypes';

@Injectable({
  providedIn: 'root'
})
export class MessagesService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  /* private subjects */
  private showChatFeedSubject: BehaviorSubject<Boolean> = new BehaviorSubject<Boolean>(false);
  private chatFeedMessagesSubject: BehaviorSubject<MessageData[]> = new BehaviorSubject<MessageData[]>([]);
  private chatReceiverSubject: BehaviorSubject<UserData | null> = new BehaviorSubject<UserData | null>(null);

  /* public observables */
  showChatFeedObservable: Observable<Boolean> = this.showChatFeedSubject.asObservable();
  chatFeedMessagesObservable: Observable<MessageData[]> = this.chatFeedMessagesSubject.asObservable();
  chatReceiverObservable: Observable<UserData | null> = this.chatReceiverSubject.asObservable();

  /* subscriptions */
  private onAuthStateChangedUnsubcribe: Unsubscribe | null = null;

  constructor() {
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
  }

  private clearSubscriptions() {
    if (this.onAuthStateChangedUnsubcribe != null) {
      this.onAuthStateChangedUnsubcribe();
      this.onAuthStateChangedUnsubcribe = null;
    }
  }

  openchatFeed(otherUser: UserData) {
    this.showChatFeedSubject.next(true);
    this.chatReceiverSubject.next(otherUser);
    this.retrieveChats(otherUser.email)
    .then((retrievedMessages: MessageData[]) => {
      this.chatFeedMessagesSubject.next(retrievedMessages);
    });
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
          else {
            /* There exists 1 or no 'conversations' document and 'allMessages' subcollection. WriteBatch.set will create these if necessary */
            messageWriteBatch.set(doc(collection(this.firestore, "conversations")).withConverter(convserationInfoConverter), {
              "conversationID": messagesDocumentId,
              "messenger1": currUserEmail,
              "messenger2": otherEmail
            });

            messageWriteBatch.set(doc(collection(this.firestore, `messages/${messagesDocumentId}/allMessages`)).withConverter(messageDataConverter), newMessageData);

            /* commit the changes */
            messageWriteBatch.commit()
            .then(() => resolve())
            .catch((error: FirestoreError) => reject(error));
          }

        })
        .catch((error: FirestoreError) => reject(error));
    });

  }

  private retrieveChats(otherEmail: string) : Promise<MessageData[]> {
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
    let currentHour = date.getHours();
    let currentMinute = date.getMinutes();
    let currentMS = date.getMilliseconds();

    // we will display the date as DD-MM-YYYY H:M:MS

    return `${currentDay}-${currentMonth}-${currentYear} ${currentHour}:${currentMinute}:${currentMS}`;
  }


}
