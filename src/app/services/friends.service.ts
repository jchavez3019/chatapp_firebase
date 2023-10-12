/*
  This service deals with friends, friend requests, friend suggestions, and searching for users to add as friends.
*/
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, filter, take, tap } from 'rxjs';

/* firebase */
import { Auth, User, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, FirestoreError, where, collection, getDocs, query, DocumentData, QuerySnapshot, addDoc, DocumentReference, Unsubscribe, onSnapshot, doc, writeBatch, WriteBatch, CollectionReference } from '@angular/fire/firestore';

/* templates */
import { UserData, userDataConverter } from '../firestore.datatypes';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class FriendsService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  /* private subjects */
  private allFriendsSubject: BehaviorSubject<UserData[]> = new BehaviorSubject<UserData[]>([]);

  /* public observables */
  allFriendsObservable: Observable<UserData[]> = this.allFriendsSubject.asObservable();

  /* path to current user's 'myFriends' sub collection */
  currUserMyFriendsCollection: CollectionReference | null = null;

  /* subscriptions */
  private allFriendsOnsnapshotUnsubscribe: Unsubscribe | null = null;
  private onAuthStateChangedUnsubscribe: Unsubscribe | null = null;


  constructor(private authService: AuthService) {


    this.onAuthStateChangedUnsubscribe = onAuthStateChanged(this.auth, (credential: User | null) => {
      if (credential) {
        /* perform initializations */
        this.initializeFriendsSubject();  
      } 
      else {
        /* user has signed out, reset all */
        this.resetFields();
      }
    });

  }

  ngOnDestroy() {
    this.clearSubscriptions();
    this.resetFields();
  }

  /* Author: Jorge Chavez
    Description:
      Any global data needs to be nulled or set to empty, and all subjects should publish null or empty. This
      functionality is required when logging out so that data does not leak to another user
    Inputs:
      None
    Outputs:
      None
    Returns:
      None
    Effects:
      This resets all global variables and publishes empty data through all subjects
  */
  resetFields() {
    this.allFriendsSubject.next([]);
    this.currUserMyFriendsCollection = null;
  }

  /* Author: Jorge Chavez
    Description:
      Clears all subscriptions
    Inputs:
      None
    Outputs:
      None
    Returns:
      None
    Effects:
      Removes all subscriptions
  */
  clearSubscriptions() {
    /* unsubscribe to snapshots */
    if (this.allFriendsOnsnapshotUnsubscribe != null) {
      this.allFriendsOnsnapshotUnsubscribe();
      this.allFriendsOnsnapshotUnsubscribe = null;
    }

    if (this.onAuthStateChangedUnsubscribe != null) {
      this.onAuthStateChangedUnsubscribe();
      this.onAuthStateChangedUnsubscribe = null;
    }
  }

  /* Author: Jorge Chavez
    Description: This function initializes the allFriendsSubject Subject variable so that components can subscribe to the subject
                 and get the most recent changes to the current user's friends list.
    Inputs: None
    Outputs: None
    Returns: None
    Effects: Starts the emission of the allFriendsSubject Subject
  */
  initializeFriendsSubject() {
        
      /* first query for the current user's friend list */
      const friendsQuery = query(collection(this.firestore, "friends"), where("email", "==", this.auth.currentUser?.email));
      getDocs(friendsQuery)
      .then(async (friends_snapshot: QuerySnapshot<DocumentData>) => {

        /* if the user has no document in the 'friends' collection, it must be created along with a temporary entry in the 'myFriends' subcollection */
        if (friends_snapshot.empty) {

          await addDoc(collection(this.firestore, 'friends'), { email: this.auth.currentUser?.email} )
          .then((docRef: DocumentReference<DocumentData>) => {
            this.currUserMyFriendsCollection = collection(this.firestore, `friends/${docRef.id}/myFriends`);
          })
          .catch((error: FirestoreError) => {
            console.log(error);
          });
          
        }
        else {
          this.currUserMyFriendsCollection = collection(this.firestore, `friends/${friends_snapshot.docs[0].id}/myFriends`);
        }

        /* create a snapshot for the myFriends subcollection and emit through the allFriends Subject when there is a change */
        const friendsSubCollectionRef = query(<CollectionReference>this.currUserMyFriendsCollection, where("email", "!=", this.auth.currentUser?.email));
        this.allFriendsOnsnapshotUnsubscribe = onSnapshot(friendsSubCollectionRef,
          (myFriendsSnapshot: QuerySnapshot<DocumentData>) => {

            /* extract the updated friend's list for the current user */
            let updatedFriendsEmails: string[] = [];
            for (let i = 0; i < myFriendsSnapshot.size; i++) {
              updatedFriendsEmails.push(myFriendsSnapshot.docs[i].data()['email']);
            }

            if (updatedFriendsEmails.length > 0) {
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
              })
              .catch((error: FirestoreError) => console.log(error));
            }

          },
          (error: FirestoreError) => {
            console.log("Error getting subcollection of friends with message: " + error.message);
          });
      })
      .catch((error: FirestoreError) => console.log("Error initializing friends subject with message:\n" + error.message));
  }

  unsubscribeAll() {
    if (this.allFriendsOnsnapshotUnsubscribe != null) {
      this.allFriendsOnsnapshotUnsubscribe();
      this.allFriendsOnsnapshotUnsubscribe = null;
    }
  }

}
