import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription, filter } from 'rxjs';
import { Auth, Unsubscribe, User, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, collection, addDoc, CollectionReference, DocumentReference, and, or, setDoc, doc, getDocs, updateDoc, onSnapshot, DocumentSnapshot, query, QuerySnapshot, FirestoreError, DocumentData, where, QueryFilterConstraint, deleteDoc, WriteBatch, writeBatch } from '@angular/fire/firestore';
import { RequestData, UserData, requestDataConverter, userDataConverter } from '../firestore.datatypes';
import { FriendsService } from './friends.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class RequestsService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  private requestCollectionRef: CollectionReference = collection(this.firestore, "requests");
  private friendsCollectionRef = collection(this.firestore, "friends");

  /* fields that will be updated by snapshots */
  private allReceivedRequests: UserData[] = [];
  private allSentRequests: UserData[] = [];

  /* private subjects */
  private receivedRequestsSubject: BehaviorSubject<UserData[]> = new BehaviorSubject<UserData[]>([]);
  private sentRequestsSubject: BehaviorSubject<UserData[]> = new BehaviorSubject<UserData[]>([]);

  /* public subjects */
  receivedRequestsObservable: Observable<UserData[]> = this.receivedRequestsSubject.asObservable();
  sentRequestsObservable: Observable<UserData[]> = this.sentRequestsSubject.asObservable();

  /* subscriptions */
  private receivedRequestsOnsnapshotUnsubscribe: Unsubscribe | null = null;
  private onAuthStateChangedUnsubscribe: Unsubscribe | null = null;

  constructor(private authService: AuthService, private friendsService: FriendsService) {

      this.onAuthStateChangedUnsubscribe = onAuthStateChanged(this.auth, (credential: User | null) => {
        if (credential) {
          /* perform initializations */
          this.initializeRecievedRequests();
          this.initializeSentRequests();  
        } 
      });

  }

  ngOnDestroy() {
    /* unsubscribe to snapshots */
    if (this.receivedRequestsOnsnapshotUnsubscribe != null) {
      this.receivedRequestsOnsnapshotUnsubscribe();
      this.receivedRequestsOnsnapshotUnsubscribe = null;
    }

    if (this.onAuthStateChangedUnsubscribe != null) {
      this.onAuthStateChangedUnsubscribe();
      this.onAuthStateChangedUnsubscribe = null;
    }
      

  }

  /* Author: Jorge Chavez
    Description: 
      This populates the 'allReceivedRequests' array for the first time as well as creates a snapshot that is
      responsible for adding new requests to the same array as well as emitting the users that have just
      sent a new request to the current user.
    Inputs:
      None
    Outputs:
      None
    Returns:
      None
    Effects:
      * Populates and asynchonously pushes users to the 'allReceivedRequests' array
      * Emits newly recieved requests
  */
  initializeRecievedRequests() {

    const receivedRequestsQuery = query(collection(this.firestore, "requests").withConverter(requestDataConverter), where("receiver", "==", this.auth.currentUser?.email));
    this.receivedRequestsOnsnapshotUnsubscribe = onSnapshot(receivedRequestsQuery, {
      next: (receivedRequests_snapshot: QuerySnapshot<RequestData>) => {



        /* extract the emails of the users that the current user has sent requests to */
        let addedOtherUsersEmails: string[] = [];

        receivedRequests_snapshot.docChanges().forEach((change) => {
          if (change.type === "added")
            addedOtherUsersEmails.push(change.doc.data()['sender']);
        })

        if (addedOtherUsersEmails.length !== 0) {
          /* get the user data for these other users that are receiving a friend request from the current user */
          const addedUsersDataQuery = query(collection(this.firestore, "users").withConverter(userDataConverter), where("email","in",addedOtherUsersEmails));
          getDocs(addedUsersDataQuery)
          .then((receivedRequestsUserData_snapshot: QuerySnapshot<UserData>) => {

            /* extract the user data for the other users */
            receivedRequestsUserData_snapshot.forEach((user_data) => {
              this.allReceivedRequests.push(user_data.data());
            });

            /* emit the user's requests with the newly added requests */
            this.receivedRequestsSubject.next(this.allReceivedRequests);

          });
        }
        
      }
    });

  }

  initializeSentRequests() {

    const sentRequestsQuery = query(collection(this.firestore, "requests").withConverter(requestDataConverter), where("sender", "==", this.auth.currentUser?.email));
    getDocs(sentRequestsQuery)
    .then((sentRequests_snapshot: QuerySnapshot<RequestData>) => {

      /* extract the emails of the users that have received a request from the current user */
      let otherUserEmails: string[] = [];
      for (let i = 0; i < sentRequests_snapshot.size; i++) {
        otherUserEmails.push(sentRequests_snapshot.docs[i].data()['receiver']);
      }

      /* get the user data if there does exist other users that have received a request from the current user */
      if (otherUserEmails.length !== 0) {
        const otherUsersDataQuery = query(collection(this.firestore, "users").withConverter(userDataConverter), where("email", "in", otherUserEmails));
        getDocs(otherUsersDataQuery)
        .then((sentRequestsUserData_snapshot: QuerySnapshot<UserData>) => {
          sentRequestsUserData_snapshot.forEach((user_doc) => { this.allSentRequests.push(user_doc.data()); })
        });
      }

    });

  }

  /* send a friend request from the current user to the specified user */
  addRequest(newToRequest: string): Promise<DocumentReference<RequestData>> {

    let newFriendRequest: RequestData = {
      sender: <string>this.auth.currentUser?.email,
      receiver: newToRequest
    }

    /* add the other user to 'allSentRequests' and emit their data to the 'newlySentRequests' subject */
    let otherUserQuery = query(collection(this.firestore, "users").withConverter(userDataConverter), where("email", "==", newToRequest));
    getDocs(otherUserQuery)
    .then((otherUser_snapshot: QuerySnapshot<UserData>) => {
      let otherUser = otherUser_snapshot.docs[0].data();

      this.allSentRequests.push(otherUser);
      this.sentRequestsSubject.next(this.allSentRequests);

    });


    return addDoc<RequestData>(this.requestCollectionRef.withConverter(requestDataConverter), newFriendRequest);
  }

  /* Author: Jorge Chavez
    Description: Accepts a friend request. 
    Inputs: friendRequest: any --
    Outputs: None
    returns: None
    Effects: Accepts friend request and updates Firestore
    Notes: Will be updated to use WriteBatch since the Firestore operations should be atomic.
  */
  acceptRequests(friendRequest: any) {
    
    let currUserMyFriendsCollection: CollectionReference;

    if (this.friendsService.currUserMyFriendsCollection != null) {
      currUserMyFriendsCollection = this.friendsService.currUserMyFriendsCollection;
    }
    else {
      return new Promise((resolve, reject) => { reject("No collection reference exists to the current user's myFriends subcollection") });
    }

    return new Promise((resolve, reject) => {

      /* 
        Create and call async function since this promise cannot get fulfilled until
        it resolves the firebase promises
      */
      (async () => {

        /* emails */
        const currUserEmail = this.auth.currentUser?.email;
        const otherUserEmail = friendRequest.email;

        let acceptRequestBatch: WriteBatch = writeBatch(this.firestore); // batch for atomic operations in Firestore

        /* queries for both users */
        const currUserFriendsQuery = query(this.friendsCollectionRef, where("email","==", this.auth.currentUser?.email));
        const otherUserFriendsQuery = query(this.friendsCollectionRef, where("email", "==", friendRequest.email));

        /* add other user as a friend for the current user */
        const prom1 = getDocs(currUserFriendsQuery)
        .then(async (snapshot: QuerySnapshot<DocumentData>) => {

          /* if the document does not exist, create it with a subcollection */
          if (snapshot.empty) {

            /* create the new document for the current user */
            await addDoc(this.friendsCollectionRef, { email: currUserEmail })
            .then((docRef: DocumentReference<DocumentData>) => {

              /* create the new subcollection with one new entry */
              acceptRequestBatch.set(doc(currUserMyFriendsCollection), {email: otherUserEmail });
            })
          }
          /* multiple friend documents for a single user exists, this is an error */
          else if (snapshot.size > 1) {
            reject("Multiple friend docs exist for current user");
          } 
          /* append the other user to the current user's subcollection */
          else {

            /* get the id of the current user's friend document */
            const docId = snapshot.docs[0].id;

            /* get the reference to the subcollection and generate a new myFriends document */
            const subCollectionRef = collection(this.firestore, `friends/${docId}/myFriends`);
            const newSubDocRef = doc(subCollectionRef);

            /* append the other user as a new friend */
            acceptRequestBatch.set(newSubDocRef, { email: otherUserEmail });

          }
        })
        .catch((error: FirestoreError) => {
          reject(error);
        });

        /* add the current user as a friend for the other user */
        const prom2 = getDocs(otherUserFriendsQuery)
        .then(async (snapshot: QuerySnapshot<DocumentData>) => {

          /* if the document does not exist, create it with a subcollection */
          if (snapshot.empty) {

            /* create the new document for the other user */
            await addDoc(this.friendsCollectionRef, { email: otherUserEmail })
            .then((docRef: DocumentReference<DocumentData>) => {
              /* get the id of the new document and generate a ref for the new subcollection */
              const myFriendsSubcollection = collection(this.firestore, `friends/${docRef.id}/myFriends`);

              /* create the new subcollection with one new entry */
              acceptRequestBatch.set(doc(myFriendsSubcollection), { email: currUserEmail });
            })
          }
          /* multiple friend documents for a single user exists, this is an error */
          else if (snapshot.size > 1) {
            reject("Multiple friend docs exist for other user");
          }
          /* append the current user to the other user's friend document */
          else {

            /* get the id of the current user's friend document */
            const docId = snapshot.docs[0].id;

            /* get the reference to the subcollection and generate a new myFriends document */
            const subCollectionRef = collection(this.firestore, `friends/${docId}/myFriends`);
            const newSubDocRef = doc(subCollectionRef);

            /* append the other user as a new friend */
            acceptRequestBatch.set(newSubDocRef, { email: currUserEmail });
          }
        })
        .catch((error: FirestoreError) => {
          reject(error);
        });

        /* remove the friend request now that is has been accepted */
        const currFilterList: QueryFilterConstraint[] = [where("receiver", "==", currUserEmail), where("sender", "==", otherUserEmail)];
        const currReqQueryFilter = and(...currFilterList);
        const currReqQuery = query(this.requestCollectionRef, currReqQueryFilter);

        /* find the document that satisfies the query */
        const prom3 = getDocs(currReqQuery)
        .then((snapshot: QuerySnapshot<DocumentData>) => {

          /* check potential edgecases */
          if (snapshot.empty) {
            reject("Error: request never exists yet friends were added");
          }
          else if (snapshot.size > 1) {
            reject("Error: multiple requests existed");
          }
          else {
            /* now remove the document */

            /* get the document reference */
            const docId = snapshot.docs[0].id;
            const docRef = doc(this.firestore, `requests/${docId}`);

            /* delete the request */
            acceptRequestBatch.delete(docRef);
          }
        })
        .catch((error: FirestoreError) => {
          reject(error);
        });

        /* now need to check edge case where the other user has also sent a friend request */
        const otherFilterList: QueryFilterConstraint[] = [where("receiver", "==", otherUserEmail), where("sender", "==", currUserEmail)];
        const otherReqQueryFilter = and(...otherFilterList);
        const otherReqQuery = query(this.requestCollectionRef, otherReqQueryFilter);

        const prom4 = getDocs(otherReqQuery)
        .then((snapshot: QuerySnapshot<DocumentData>) =>  {
          /* if request dne, return */
          if (snapshot.empty)
            return;

          /* get the document reference */
          const docId = snapshot.docs[0].id;
          const docRef = doc(this.firestore, `requests/${docId}`);

          /* delete the request */
          acceptRequestBatch.delete(docRef);
          
        })
        .catch((error: FirestoreError) => {
          reject(error);
        });

        await Promise.all([prom1, prom2, prom3, prom4]);

        /* commit all the changes to Firestore atomically */
        acceptRequestBatch.commit()
        .then(() => {
          
          let idx = this.allReceivedRequests.map((user) => user.email).findIndex((email) => email == otherUserEmail);
          if (idx !== -1) {
            /* removed the received request now that its been accepted, and emit the updated receivedRequestsSubject */
            this.allReceivedRequests.splice(idx, 1);
            this.receivedRequestsSubject.next(this.allReceivedRequests);
          }

          resolve("Successful writeBatch to Firestore");
        })
        .catch( (error: FirestoreError) => {
          reject(error);
        });

      })();
    });
  };

  /* Author: Jorge Chavez
    Description:
      Deletes a friend request locally and in Firestore.
    Inputs: 
      friendRequest -- the friend request to delete
    Outputs:
      None
    Returns:
      None
    Effects:
      * Removes other user from 'allReceivedRequests' 
      * Emits through 'receivedRequestsSubject'
  */
  deleteRequests(friendRequest: any) {

    /* emails */
    const currUserEmail = this.auth.currentUser?.email;
    const otherUserEmail = friendRequest.email;

    /* building query */
    const reqQueryFilter = and(where("receiver", "==", currUserEmail), where("sender", "==", otherUserEmail));
    const reqQuery = query(this.requestCollectionRef, reqQueryFilter);

    getDocs(reqQuery)
    .then((snapshot: QuerySnapshot<DocumentData>) => {

      /* check potential edgecases */
      if (snapshot.empty) {
        throw("Error: request never exists yet friends were added");
      }
      else if (snapshot.size > 1) {
        throw("Error: multiple requests existed");
      }
      else {
        
        /* get the document reference */
        const docId = snapshot.docs[0].id;
        const docRef = doc(this.firestore, `requests/${docId}`);

        /* delete the request */
        deleteDoc(docRef)
        .then(() => {
          /* removed the received request now that its been rejected, and emit the updated receivedRequestsSubject */
          let idx = this.allReceivedRequests.map((user) => user.email).findIndex((email) => email == otherUserEmail);
          if (idx !== -1) {
            this.allReceivedRequests.splice(idx, 1);
            this.receivedRequestsSubject.next(this.allReceivedRequests);
          }
        })
        .catch((error: FirestoreError) => console.log("Error deleting request with message: " + error.message));
      }
    })
    .catch((error: FirestoreError) => console.log("Error getting request to delete with message: " + error.message));
  }

    /* unsubcribes to any and all subjects/snapshots */
    unsubcribeAll() {
      if (this.receivedRequestsOnsnapshotUnsubscribe != null) {
        this.receivedRequestsOnsnapshotUnsubscribe();
        this.receivedRequestsOnsnapshotUnsubscribe = null;
      }
      
    }

}
