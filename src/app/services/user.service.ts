import { Injectable, inject, OnDestroy } from '@angular/core';
import { Auth, authState, User, user, createUserWithEmailAndPassword, UserCredential, updateProfile, AuthSettings, signInWithEmailAndPassword, signOut } from '@angular/fire/auth';
import { Firestore, collection, collectionData, addDoc, CollectionReference, DocumentReference, setDoc, doc, getDoc, updateDoc, onSnapshot, DocumentSnapshot } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

/* import userProfile interface */
import { UserProfile } from '@angular/fire/auth';
import { BADHINTS } from 'dns';
import { userProfile } from './auth.service';


@Injectable({
  providedIn: 'root'
})
export class UserService implements OnDestroy {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private unsub: any;

  authState$ = authState(this.auth);
  authStateSubscription: any;

  /* current user whose information will be displayed in the dashboard */
  currentUser: BehaviorSubject<UserProfile | undefined> = new BehaviorSubject<UserProfile | undefined>({
    email: "",
    displayName: "",
    photoURL: ""
  });

  // private firestore: Firestore = inject(Firestore);

  constructor() {
    /* userful for handling auth state chanegs */
    this.authStateSubscription = this.authState$.subscribe((aUser: User | null) => {
      // this.currentUser.next(aUser);
    });

    /* get the user's uid */
    const userId = this.auth.currentUser?.uid;

    /* create custom document references */
    const userDoc = doc(this.firestore, `users/${userId}`);

    /* using snapshot to get changes to the user document */
    this.unsub = onSnapshot(userDoc, {
      next: (doc_snapshot: DocumentSnapshot<UserProfile>) => {
        // console.log(doc_snapshot);

        /* if the snapshot is defined, emit the current user's profile data */
        if (doc_snapshot != undefined) {
          const updatedUserProfile: UserProfile | undefined = doc_snapshot.data();
          this.currentUser.next(updatedUserProfile);  
        }
      },
      error: (error) => {
        console.log("Error in snapshot: " + error);
      }
    });
    
   }

   ngOnDestroy(): void {
    // when manually subscribing to an observable remember to unsubscribe in ngOnDestroy
    this.authStateSubscription.unsubscribe();
    this.unsub();
  }

  async updateNickname(newname: string) {
    var result = null;

    /* get user auth uid */
    const userId = this.auth.currentUser?.uid;

    /* create custom document references */
    const userDoc = doc(this.firestore, `users/${userId}`);

    await updateDoc(userDoc, { displayName: newname })
    .catch((error) => {
      const errorCode = error.code;
      const errorMessage = error.message;
      console.log("error code: " + errorCode + " with msg: " + errorMessage);
      result = errorCode;
    });

    if (result != null) {
      throw Error(result);
    }

  }


}
