import { Injectable, inject } from '@angular/core';
import { Subscription, Subject, combineLatest, mergeAll } from 'rxjs';
import { FriendsService } from './friends.service';
import { RequestsService } from './requests.service';
import { UserData, userDataConverter } from '../firestore.datatypes';

import { Auth, User } from '@angular/fire/auth';
import { Firestore, collection, query, where, and, or, collectionData, addDoc, CollectionReference, DocumentReference, setDoc, doc, getDoc, getDocs, updateDoc, onSnapshot, DocumentSnapshot, snapToData, QuerySnapshot, QueryFilterConstraint, FirestoreError, DocumentData, startAfter, orderBy, limit } from '@angular/fire/firestore';


@Injectable({
  providedIn: 'root'
})
export class SuggestionsService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  private combineSubscription: Subscription | null = null;

  private nonSuggestableUsers: UserData[] = [];

  suggestsSubject: Subject<UserData[]> = new Subject();


  constructor(private friendsService: FriendsService, private requestsService: RequestsService) {

    /* create basic friends suggestions for the current user */
    this.initializeBasicSuggestions();
  
   }

  ngOnDestroy() {

    /* unsubscribe to all subjects */
    if (this.combineSubscription != null)
      this.combineSubscription.unsubscribe();
  }

  initializeBasicSuggestions() {
    const newSuggestionsDesiredLength = 50;
    combineLatest([this.friendsService.allFriendsSubject, this.requestsService.receivedRequestsSubject, this.requestsService.sentRequestsSubject]).pipe(
      mergeAll() // merges all the users into a single array
    )
    .subscribe((usersNotToSuggest: UserData[]) => {
      this.nonSuggestableUsers = usersNotToSuggest;

      let newSuggestions: UserData[] = [];

      /* query Firestore for users to suggest */
      getDocs(query(collection(this.firestore, 'users').withConverter(userDataConverter), orderBy("email"), limit(newSuggestionsDesiredLength)))
      .then((users_snapshot: QuerySnapshot<UserData>) => {

        let lastEmail: string = "";
        for (let i = 0; i < users_snapshot.size; i++) {
          let curr_data = users_snapshot.docs[i].data();
          if (!this.nonSuggestableUsers.includes(curr_data) && curr_data.email != this.auth.currentUser?.email) {
            newSuggestions.push(curr_data);
          }
          if (i === users_snapshot.size - 1)
            lastEmail = curr_data.email;
        }

        if (newSuggestions.length === newSuggestionsDesiredLength) {
          this.suggestsSubject.next(newSuggestions);
        }
        else {
          /* recursively seek more users until the newSuggestions array is at the desired length */
          this.recursiveQuery(lastEmail, newSuggestionsDesiredLength, newSuggestions);
        }
      })

    });
  }

  /* helper function for building up suggestions */
  recursiveQuery(startingEmail: string, desiredLength: number, newSuggestions: UserData[]) {

    getDocs(query(collection(this.firestore, 'users').withConverter(userDataConverter), orderBy("email"), limit(desiredLength), startAfter(startingEmail)))
    .then((users_snapshot: QuerySnapshot<UserData>) => {

      /* there are no more users to pull from, return the list of suggestions even if it falls short */
      if (users_snapshot.empty) {
        this.suggestsSubject.next(newSuggestions);
        return;
      }

      let lastEmail: string = "";
      for (let i = 0; i < users_snapshot.size; i++) {

        let curr_data = users_snapshot.docs[i].data(); // current snapshot data

        /* if the user can be suggested, append it */
        if (!this.nonSuggestableUsers.includes(curr_data)) {
          newSuggestions.push(curr_data);
        }

        /* save the email of the last element to start after in the next recursion */
        if (i === users_snapshot.size - 1)
          lastEmail = curr_data.email;

        /* emit and return if the suggestions are at the desired length */
        if (newSuggestions.length === desiredLength) {
          this.suggestsSubject.next(newSuggestions);
          return;
        }
      }

      /* recursively seek more users until the newSuggestions array is at the desired length */
      this.recursiveQuery(lastEmail, desiredLength, newSuggestions);
      
    })
  }



  
}
