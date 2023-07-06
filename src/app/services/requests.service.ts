import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { Auth, authState, User, user, createUserWithEmailAndPassword, UserCredential, updateProfile, AuthSettings, signInWithEmailAndPassword, signOut, Unsubscribe } from '@angular/fire/auth';
import { Firestore, collection, collectionData, addDoc, CollectionReference, DocumentReference, and, or, setDoc, doc, getDocs, updateDoc, onSnapshot, DocumentSnapshot, query, QuerySnapshot, FirestoreError, DocumentData, where, QueryFilterConstraint, deleteDoc } from '@angular/fire/firestore';
import { RequestData, UserData, requestDataConverter, userDataConverter } from '../firestore.datatypes';

@Injectable({
  providedIn: 'root'
})
export class RequestsService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  private requestCollectionRef: CollectionReference = collection(this.firestore, "requests");
  private friendsCollectionRef = collection(this.firestore, "friends");
  private usersCollectionRef: CollectionReference = collection(this.firestore, "users");

  /* fields that will be updated by snapshots */
  receivedRequestsSubject: Subject<UserData[]> = new Subject();
  sentRequestsSubject: Subject<UserData[]> = new Subject();

  /* snapshot subscriptions that must be unsubscribed to */
  private receivedRequestsOnsnapshotUnsubscribe: Unsubscribe | null = null;
  private sentRequestsOnsnapshotUnsubscribe: Unsubscribe | null = null;

  constructor() {
      /* subscribe to the friend requests the current user has received */
      this.initializeReceivedRequestsSubject();

      /* subscribe to the friends requests the current user has sent */
      this.initializeSentRequestsSubject();
   }

  ngOnDestroy() {
    /* unsubscribe to snapshots */
    if (this.receivedRequestsOnsnapshotUnsubscribe != null)
      this.receivedRequestsOnsnapshotUnsubscribe();

    if (this.sentRequestsOnsnapshotUnsubscribe != null)
      this.sentRequestsOnsnapshotUnsubscribe();
  }

  initializeReceivedRequestsSubject() {
    const receivedRequestsQuery = query(collection(this.firestore, "requests").withConverter(requestDataConverter), where("receiver", "==", this.auth.currentUser?.email));
    this.receivedRequestsOnsnapshotUnsubscribe = onSnapshot(receivedRequestsQuery, {
      next: (receivedRequests_snapshot: QuerySnapshot<RequestData>) => {
        /* extract the emails of the users that the current user has sent requests to */
        let updatedOtherUsersEmails: string[] = [];
        for (let i = 0; i < receivedRequests_snapshot.size; i++) {
          updatedOtherUsersEmails.push(receivedRequests_snapshot.docs[i].data()['sender']);
        }

        /* get the user data for these other users that are receiving a friend request from the current user */
        const updatedOtherUsersDataQuery = query(collection(this.firestore, "users").withConverter(userDataConverter), where("email","in",updatedOtherUsersEmails));
        getDocs(updatedOtherUsersDataQuery)
        .then((receivedRequestsUserData_snapshot: QuerySnapshot<UserData>) => {

          /* extract the user data for the other users */
          let updatedOtherUsersData: UserData[] = [];
          for (let i = 0; i < receivedRequestsUserData_snapshot.size; i++) {
            updatedOtherUsersData.push(receivedRequestsUserData_snapshot.docs[i].data());
          }

          /* emit the updated list */
          this.receivedRequestsSubject.next(updatedOtherUsersData);
        });
      }
    })
  }

  initializeSentRequestsSubject() {

    const sentRequestsQuery = query(collection(this.firestore, "requests").withConverter(requestDataConverter), where("sender", "==", this.auth.currentUser?.email));
    this.sentRequestsOnsnapshotUnsubscribe = onSnapshot(sentRequestsQuery, {
      next: (sentRequests_snapshot: QuerySnapshot<RequestData>) => {
        /* extract the emails of the users that the current user has sent requests to */
        let updatedOtherUsersEmails: string[] = [];
        for (let i = 0; i < sentRequests_snapshot.size; i++) {
          updatedOtherUsersEmails.push(sentRequests_snapshot.docs[i].data()['sender']);
        }

        /* get the user data for these other users that are receiving a friend request from the current user */
        const updatedOtherUsersDataQuery = query(collection(this.firestore, "users").withConverter(userDataConverter), where("email","in",updatedOtherUsersEmails));
        getDocs(updatedOtherUsersDataQuery)
        .then((sentRequestsUserData_snapshot: QuerySnapshot<UserData>) => {

          /* extract the user data for the other users */
          let updatedOtherUsersData: UserData[] = [];
          for (let i = 0; i < sentRequestsUserData_snapshot.size; i++) {
            updatedOtherUsersData.push(sentRequestsUserData_snapshot.docs[i].data());
          }

          /* emit the updated list */
          this.sentRequestsSubject.next(updatedOtherUsersData);
        });
      }
    });
  }

  /* send a friend request from the current user to the specified user */
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

    return addDoc<RequestData>(this.requestCollectionRef.withConverter(requestDataConverter), newFriendRequest);
  }

  acceptRequests(friendRequest: any) {

    return new Promise((resolve, reject) => {

      /* 
        Create and call async function since this promise cannot get fulfilled until
        it resolves the firebase promises
      */
      (async () => {
        /* emails */
        const currUserEmail = this.auth.currentUser?.email;
        const otherUserEmail = friendRequest.email;

        /* querires for both users */
        const currUserFriendsQuery = query(this.friendsCollectionRef, where("email","==", this.auth.currentUser?.email));
        const otherUserFriendsQuery = query(this.friendsCollectionRef, where("email", "==", friendRequest.email));

        /* add other user as a friend for the current user */
        const prom1 = getDocs(currUserFriendsQuery)
        .then((snapshot: QuerySnapshot<DocumentData>) => {

          /* if the document does not exist, create it with a subcollection */
          if (snapshot.empty) {

            /* create the new document for the current user */
            addDoc(this.friendsCollectionRef, { email: currUserEmail })
            .then((docRef: DocumentReference<DocumentData>) => {
              /* get the id of the new document and generate a ref for the new subcollection */
              const docId = docRef.id;
              const newSubDocRef = doc(this.firestore, `friends/${docId}`);

              /* create the new subcollection with one new entry */
              setDoc(newSubDocRef, { email: otherUserEmail });
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

            /* get the reference to the subcollection */
            const subCollectionRef = collection(this.firestore, `friends/${docId}/myFriends`);

            /* append the other user as a new friend */
            addDoc(subCollectionRef, { email: otherUserEmail });

          }
        });

        /* add the current user as a friend for the other user */
        const prom2 = getDocs(otherUserFriendsQuery)
        .then((snapshot: QuerySnapshot<DocumentData>) => {

          /* if the document does not exist, create it with a subcollection */
          if (snapshot.empty) {

            /* create the new document for the other user */
            addDoc(this.friendsCollectionRef, { email: otherUserEmail })
            .then((docRef: DocumentReference<DocumentData>) => {
              /* get the id of the new document and generate a ref for the new subcollection */
              const docId = docRef.id;
              const newSubDocRef = doc(this.firestore, `friends/${docId}`);

              /* create the new subcollection with one new entry */
              setDoc(newSubDocRef, { email: currUserEmail });
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

            /* get the reference to the subcollection */
            const subCollectionRef = collection(this.firestore, `friends/${docId}/myFriends`);

            /* append the other user as a new friend */
            addDoc(subCollectionRef, { email: currUserEmail });
          }
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

            console.log("Removing request with id: " + docId);

            /* delete the request */
            deleteDoc(docRef)
            .catch((error) => {
              console.log("Error delting doc");
            });
          }
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

          console.log("Removing request with id: " + docId);

          /* delete the request */
          deleteDoc(docRef)
          .catch((error) => {
            console.log("Error delting doc");
          });
          
        });

        await Promise.all([prom1, prom2, prom3, prom4]);

        resolve("Success");
      })();
    });
  };

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
        /* now remove the document */

        /* get the document reference */
        const docId = snapshot.docs[0].id;
        const docRef = doc(this.firestore, `requests/${docId}`);

        /* delete the request */
        deleteDoc(docRef);
      }
    });
  }

}
