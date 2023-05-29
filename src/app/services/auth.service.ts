import { Injectable, OnDestroy, inject } from '@angular/core';
import { Auth, authState, User, user, createUserWithEmailAndPassword, UserCredential, updateProfile, AuthSettings } from '@angular/fire/auth';
import { Firestore, collection, collectionData, addDoc, CollectionReference, DocumentReference } from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private curr_user?: User | null;

  private auth: Auth = inject(Auth);
  user$ = user(this.auth);
  userSubscription: any;

  authState$ = authState(this.auth);
  authStateSubscription: any;

  private firestore: Firestore = inject(Firestore);

  constructor(private router: Router) {

    /* useful for handling user changes if the user is logged in */
    this.userSubscription = this.user$.subscribe((aUser: User | null) => {
      //handle user state changes here. Note, that user will be null if there is no currently logged in user.
      // console.log("Null if not logged in: " + aUser);
    });

    /* userful for handling auth state chanegs */
    this.authStateSubscription = this.authState$.subscribe((aUser: User | null) => {
      //handle auth state changes here. Note, that user will be null if there is no currently logged in user.
      // console.log("Null if not logged in: " + aUser);

      /* set the curr_user if the returned aUser is not null */
      this.curr_user = aUser != null ? aUser : null;
    })
  }

  /* check Auth */
  authUser(): boolean {
    // return (this.authstate !== null && this.authState !== undefined) ? true : false;
    return false;
  }

  /* sign up */
  signUp(usercreds: any) {

    /* from new firebase documenation */
    createUserWithEmailAndPassword(this.auth, usercreds.email, usercreds.password)
    .then((userCredential) => {
      /* at this point the user is signed in and the new user is returned as userCredential */
      console.log(userCredential);

      /* save the user locally */
      this.curr_user = userCredential.user;

      /* update the profile of the newly created user */
      updateProfile(this.curr_user, {
        displayName: usercreds.displayName,
        photoURL: "https://example.com/jane-q-user/profile.jpg"
      });
    })
    .catch((error) => {
      /* one error to check if the case where the user already exists */
      const errorCode = error.code;
      const errorMessage = error.message;
      console.log("error code: " + errorCode + " with msg: " + errorMessage);
    })
    .then(() => {
      /* now update this user locally */
      this.setUserData(usercreds.email, usercreds.displayName, "https://example.com/jane-q-user/profile.jpg");
    });
    return;
  }

  /* set user data to a local users collections used to reference throughout the application */
  setUserData(email: string, displayName: string, photoURL: string) {

    /* get user and status collections */
    const usersCollection = collection(this.firestore, 'users');
    const statusCollection = collection(this.firestore, 'status');

    /* first we add the new user to the database under 'users' */
    addDoc(usersCollection, <userProfile> { email: email, displayName: displayName, photoURL: photoURL }).then((documentReference: DocumentReference) => {
      // the documentReference provides access to the newly created document
    })
    .catch((error) => {
      /* one error to check if the case where the user already exists */
      const errorCode = error.code;
      const errorMessage = error.message;
      console.log("error code: " + errorCode + " with msg: " + errorMessage);
    });

    /* now we add the user to the status collection */
    addDoc(statusCollection, <userStatus> { online: true }).then((documentReference: DocumentReference) => {
      // the documentReference provides access to the newly created document
    })
    .catch((error) => {
      /* one error to check if the case where the user already exists */
      const errorCode = error.code;
      const errorMessage = error.message;
      console.log("error code: " + errorCode + " with msg: " + errorMessage);
    });

    this.router.navigate(['dashboard']);
  }
}

export interface userProfile {
  email: string;
  displayName: string;
  photoURL: string;
}

export interface userStatus {
  online: boolean;
}