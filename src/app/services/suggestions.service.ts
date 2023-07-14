import { Injectable, inject } from '@angular/core';
import { Subscription, combineLatest, skip, BehaviorSubject, map, tap, takeUntil, filter, take, Observable, Unsubscribable } from 'rxjs';
import { FriendsService } from './friends.service';
import { RequestsService } from './requests.service';
import { UserData, RequestData, requestDataConverter, userDataConverter } from '../firestore.datatypes';

import { Auth, Unsubscribe, User, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, FirestoreError, collection, query, getDocs, QuerySnapshot, startAfter, orderBy, limit, or, where, DocumentData } from '@angular/fire/firestore';
import { AuthService } from './auth.service';

const newSuggestionsDesiredLength = 50;
@Injectable({
  providedIn: 'root'
})
export class SuggestionsService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  private latestSuggestions: UserData[] = [];

  /* private subjects */
  private suggestsSubject: BehaviorSubject<UserData[]> = new BehaviorSubject<UserData[]>([]);

  /* public observables */
  suggestsObservable: Observable<UserData[]> = this.suggestsSubject.asObservable();

  /* subscriptions */
  private combineSubscription: Subscription | null = null;
  private onAuthStateChangedUnsubscribe: Unsubscribe | null = null;

  constructor(private authService: AuthService, private friendsService: FriendsService, private requestsService: RequestsService) {

    this.onAuthStateChangedUnsubscribe = onAuthStateChanged(this.auth, (credential: User | null) => {
      if (credential) {
        /* perform initializations */
        this.initialBasicSuggestions();
      } 
      else {
        /* user has signed out, need to reset all */
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
    this.latestSuggestions = [];
    this.suggestsSubject.next([]);
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
    /* unsubscribe to all subjects */
    if (this.combineSubscription != null) {
      this.combineSubscription.unsubscribe();
      this.combineSubscription = null;
    }

    if (this.onAuthStateChangedUnsubscribe != null) {
      this.onAuthStateChangedUnsubscribe();
      this.onAuthStateChangedUnsubscribe = null;
    }
  }

  async initialBasicSuggestions() {

      let nonSuggestableUsers: string[] = [<string>this.auth.currentUser?.email];

      /* populate 'nonSuggestableUsers' before subscribing to newly added friends/sentRequests/receivedRequests */
      const friendsQuery = query(collection(this.firestore, 'friends'), where('email', '==', this.auth.currentUser?.email));
      const allRequestsQuery = query(collection(this.firestore, 'requests').withConverter(requestDataConverter), or(where('receiver', '==', this.auth.currentUser?.email), where('sender', '==', this.auth.currentUser?.email)));
  
      /* promise for getting all the current user's friends */
      const prom1 = new Promise<void>((resolve, reject) => {
        getDocs(friendsQuery).then((friendsQuery_snapshot: QuerySnapshot<DocumentData>) => {
          if (friendsQuery_snapshot.size > 0) {
            getDocs(collection(this.firestore,`friends/${friendsQuery_snapshot.docs[0].id}/myFriends`)).then(async (myFriends_snapshot: QuerySnapshot<DocumentData>) => {
              myFriends_snapshot.forEach((user_doc) => { nonSuggestableUsers.push(user_doc.data()['email']) });
              resolve();
            })
            .catch((error: FirestoreError) => reject(error));
          }
          resolve();
        })
        .catch((error: FirestoreError) => reject(error));
      });
  
      /* promise for getting all the current user's sent and received friend requests */
      const prom2 = new Promise<void>((resolve, reject) => {
        getDocs(allRequestsQuery).then( (requests_snapshot: QuerySnapshot<RequestData>) => {
          requests_snapshot.forEach((request_doc) => { 
            const email = request_doc.data()['sender'] === this.auth.currentUser?.email ? request_doc.data()['receiver'] : request_doc.data()['sender'];
            nonSuggestableUsers.push(email); 
          });
          resolve();
        })
        .catch((error: FirestoreError) => reject(error));
      });
  
      await Promise.all([prom1, prom2])
      .catch((error) => console.log("Error getting nonsuggestable users before recursion with message: " + error.message));
  
      /* create the initial basic suggestions */
      let newSuggestions: UserData[] = [];
      this.recursiveQuery("", newSuggestionsDesiredLength, nonSuggestableUsers, newSuggestions);
  
      /* subscribed to new friends/sentRequests/receivedRequests to delete entries from suggestions if necessary */
      combineLatest([this.requestsService.sentRequestsObservable, this.requestsService.receivedRequestsObservable, this.friendsService.allFriendsObservable]).pipe(
        skip(1),
        map(([sentRequests, receivedRequests, friends], i) => {
          /* returns the emails from all 3 observables into a single array */
          return Array(...sentRequests.map((user_data) => user_data.email), ...receivedRequests.map((user_data) => user_data.email), ...friends.map((user_data) => user_data.email));
        }),
        tap((usersNotToSuggest: string[]) => console.log("suggestions curated nonsuggestableUsers:\n" + usersNotToSuggest)),
      )
      .subscribe((usersNotToSuggest: string[]) => {
  
        /* append the new user to 'nonSuggestableUsers' */
        // usersNotToSuggest.forEach((email) => { nonSuggestableUsers.push(email); });
        usersNotToSuggest.forEach((otherEmail) => {
          const idx = this.latestSuggestions.map((user) => user.email).findIndex((email) => email == otherEmail);
          if (idx != -1) {
            this.latestSuggestions.splice(idx, 1);
          }
        });
  
        this.suggestsSubject.next(this.latestSuggestions);
        
      });
  }

  /* helper function for building up suggestions */
  recursiveQuery(startingEmail: string, desiredLength: number, nonSuggestableUsers: string[], newSuggestions: UserData[]) {

    let userQuery;
    if (startingEmail == "") {
      userQuery = query(collection(this.firestore, 'users').withConverter(userDataConverter), orderBy("email"), limit(desiredLength));
    }
    else {
      userQuery = query(collection(this.firestore, 'users').withConverter(userDataConverter), orderBy("email"), limit(desiredLength), startAfter(startingEmail));
    }

    getDocs(userQuery)
    .then((users_snapshot: QuerySnapshot<UserData>) => {

      /* there are no more users to pull from, return the list of suggestions even if it falls short */
      if (users_snapshot.empty) {
        this.latestSuggestions = newSuggestions;
        this.suggestsSubject.next(newSuggestions);
        return;
      }

      let lastEmail: string = "";
      for (let i = 0; i < users_snapshot.size; i++) {

        let curr_data = users_snapshot.docs[i].data(); // current snapshot data

        /* if the user can be suggested, append it */
        if (!nonSuggestableUsers.includes(curr_data.email)) {
          newSuggestions.push(curr_data);
        }

        /* save the email of the last element to start after in the next recursion */
        if (i === users_snapshot.size - 1)
          lastEmail = curr_data.email;

        /* emit and return if the suggestions are at the desired length */
        if (newSuggestions.length === desiredLength) {
          this.latestSuggestions = newSuggestions;
          this.suggestsSubject.next(newSuggestions);
          return;
        }
      }
      
      /*  Return if there is not a sufficient amount of users to query */
      if (users_snapshot.size < desiredLength) {
        this.latestSuggestions = newSuggestions;
        this.suggestsSubject.next(newSuggestions);
        return;
      }

      /* recursively seek more users until the newSuggestions array is at the desired length */
      this.recursiveQuery(lastEmail, desiredLength, nonSuggestableUsers, newSuggestions);
      
    })
  }

  unsubscribeAll() {
    if (this.combineSubscription != null) {
      this.combineSubscription.unsubscribe();
      this.combineSubscription = null;
    }
      
  }

  
}
