/*
  This service deals with friends, friend requests, friend suggestions, and searching for users to add as friends.
*/
import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';

/* firebase */
import { Auth, User } from '@angular/fire/auth';
import { Firestore, FirestoreError, where, collection, getDocs, query, DocumentData, QuerySnapshot, addDoc, DocumentReference, Unsubscribe, onSnapshot } from '@angular/fire/firestore';

/* templates */
import { UserData, RequestData, requestDataConverter, userDataConverter } from '../firestore.datatypes';

@Injectable({
  providedIn: 'root'
})
export class FriendsService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  /* these are the fields that will be updated by snapshots */
  allFriendsSubject: Subject<UserData[]> = new Subject();

  /* snapshot subscriptions that must be unsubscribed to */
  private allFriendsOnsnapshotUnsubscribe: Unsubscribe | null = null;


  constructor() {

    /* subscribe to the friends of the current user */
    this.initializeFriendsSubject();

  }

  ngOnDestroy() {

    /* unsubscribe to snapshots */
    if (this.allFriendsOnsnapshotUnsubscribe != null)
      this.allFriendsOnsnapshotUnsubscribe();

  }

  /* Author: Jorge Chavez
    Description: This function initializes the allFriendsSubject Subject variable so that components can subscribe to the subject
                 and get the most recent changes to the current user's friends list.
    Inputs: None
    Outputs: None
    Returns: None
    Effects: Starts the emission of the allFriendsSubject Subject
  */
  async initializeFriendsSubject() {
    /* first query for the current user's friend list */
    const friendsQuery = query(collection(this.firestore, "friends"), where("email", "==", this.auth.currentUser?.email));
    getDocs(friendsQuery)
    .then(async (friends_snapshot: QuerySnapshot<DocumentData>) => {

      let friendsDocId; //  doc ID for friends collection for the current user
      const friendsCollectionRef = collection(this.firestore, "friends"); // path to friends collection

      /* if the user has no friends doc, it must create one */
      if (friends_snapshot.empty) {

        await addDoc(friendsCollectionRef, { email: this.auth.currentUser?.email })
        .then(async (newDocRef: DocumentReference<DocumentData>) => {
          friendsDocId = newDocRef.id;
        });

      }
      else {
        friendsDocId = friends_snapshot.docs[0].id;
      }

      /* create a snapshot for the myFriends subcollection and emit through the allFriends Subject when there is a change */
      const friendsSubCollectionRef = collection(this.firestore, `friends/${friendsDocId}/myFriends`);
      this.allFriendsOnsnapshotUnsubscribe = onSnapshot(friendsSubCollectionRef, {
        next: (myFriendsSnapshot: QuerySnapshot<DocumentData>) => {

          /* extract the updated friend's list for the current user */
          let updatedFriendsEmails: string[] = [];
          for (let i = 0; i < myFriendsSnapshot.size; i++) {
            updatedFriendsEmails.push(myFriendsSnapshot.docs[i].data()['email']);
          }

          /* final query uses the emails of the user's friends and gets their actual user data */
          const friendsUserDataQuery = query(collection(this.firestore, "users").withConverter(userDataConverter), where("email", "in", updatedFriendsEmails));
          getDocs(friendsUserDataQuery)
          .then((friendsUserData_snapshot: QuerySnapshot<UserData>) => {
            
            /* get the user data for all the friends */
            let updatedFriendsUserData: UserData[] = [];
            for (let i = 0; i < friendsUserData_snapshot.size; i++) {
              updatedFriendsUserData.push(friendsUserData_snapshot.docs[i].data());
            }

            /* emit the data for all the friends */
            this.allFriendsSubject.next(updatedFriendsUserData);
          });

        },
        error: (error: FirestoreError) => {

        }
      });
    })
    .catch((error: FirestoreError) => {
      console.log("Error getting subcollection of friends with head: " + error.name + " with message :" + error.message);
    });
  }

}
