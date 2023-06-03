import { Injectable, inject } from '@angular/core';
import { Auth, authState, User, user, createUserWithEmailAndPassword, UserCredential, updateProfile, AuthSettings, signInWithEmailAndPassword, signOut, Unsubscribe } from '@angular/fire/auth';
import { Firestore, collection, collectionData, addDoc, CollectionReference, DocumentReference, setDoc, doc, getDoc, updateDoc, onSnapshot, DocumentSnapshot, query, QuerySnapshot, FirestoreError, DocumentData, where } from '@angular/fire/firestore';
import { RequestData, requestDataConverter } from '../firestore.datatypes';

@Injectable({
  providedIn: 'root'
})
export class RequestsService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  private requestCollectionRef: CollectionReference<RequestData> = collection(this.firestore, "requests").withConverter(requestDataConverter);
  private friendsCollectionRef = collection(this.firestore, "friends");

  constructor() { }

  addRequest(newToRequest: string): Promise<DocumentReference<RequestData>> {

    const currUserEmail: string | null | undefined = this.auth.currentUser?.email;

    let newFriendRequest: RequestData = {
      sender: "",
      receiver: newToRequest
    }

    /* should never be null or undefined */
    if ((currUserEmail != null) && (currUserEmail != undefined)) {
      newFriendRequest.sender = currUserEmail;
    }

    return addDoc<RequestData>(this.requestCollectionRef, newFriendRequest);
  }

  getMyRequests(observerFunction: any) {
    const currUserEmail: string | null | undefined = this.auth.currentUser?.email;
    const requestsCollectionRef = collection(this.firestore, "requests");

    /* should never be null or undefined */
    if ((currUserEmail != null) && (currUserEmail != undefined)) {
      const requestsQuery = query(this.requestCollectionRef, where("receiver", "==", currUserEmail));

      return onSnapshot(requestsQuery, observerFunction);
    }

    return;
    
  }

  acceptRequests(friendRequest: any) {

    /*
      format

      friends {
        email: currUserEmail,

        collection: myFriends: {
            email: otherFriend,
            email: otherFriend2
        }
      }
    */
  }

}
