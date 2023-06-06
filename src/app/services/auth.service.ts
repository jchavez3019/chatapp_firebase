import { Injectable, OnDestroy, inject } from '@angular/core';
import { Auth, authState, User, user, createUserWithEmailAndPassword, UserCredential, updateProfile, AuthSettings, signInWithEmailAndPassword, signOut, UserProfile } from '@angular/fire/auth';
import { Firestore, collection, collectionData, addDoc, CollectionReference, DocumentReference, setDoc, doc } from '@angular/fire/firestore';
import { Router } from '@angular/router';

/* firebase data types */
import { UserData, UserStatus, userDataConverter, userStatusConverter } from '../firestore.datatypes';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {

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
    });
  }

  ngOnDestroy(): void {
    // when manually subscribing to an observable remember to unsubscribe in ngOnDestroy
    this.userSubscription.unsubscribe();
    this.authStateSubscription.unsubscribe();
  }

  /* check Auth */
  authUser(): boolean {

    /* return whether or not the user is signed in */
    return (this.auth.currentUser != null) ? true : false;
  }

  /* sign up */
  async signUp(usercreds: any) {

    var result = null;

    /* from new firebase documenation */
    await createUserWithEmailAndPassword(this.auth, usercreds.email, usercreds.password)
    .then((userCredential) => {
      /* at this point the user is signed in and the new user is returned as userCredential */
      // console.log(userCredential);

      /* update the current user */
      this.auth.updateCurrentUser(userCredential.user);

      /* update the profile of the newly created user */
      updateProfile(userCredential.user, {
        displayName: usercreds.displayName,
        photoURL: "https://www.pngall.com/wp-content/uploads/5/Profile-Male-PNG-Free-Download.png"
      });

      /* now create the user's data */
      this.setUserData(usercreds.email, usercreds.displayName, "https://www.pngall.com/wp-content/uploads/5/Profile-Male-PNG-Free-Download.png");

      /* now update the user's status */
      this.setStatus("online");

      /* navigate to the dashboard if there are no errors */
      this.router.navigate(['dashboard']);

    })
    .catch((error) => {
      /* one error to check if the case where the user already exists */
      const errorCode = error.code;
      const errorMessage = error.message;
      console.log("error code: " + errorCode + " with msg: " + errorMessage);
      result = errorCode;
    });

    if (result != null) {
      throw Error(result);
    }
  }

  /* login */
  async login(usercreds: any) {

    var result;

    await signInWithEmailAndPassword(this.auth, usercreds.email, usercreds.password)
    .then((userCredential) => {
      const status = "online";
      const user = userCredential.user;

      /* update the current user */
      this.auth.updateCurrentUser(user);

      /* update the user's status */
      this.setStatus(status);

      /* navigate to the dashboard if there are no errors */
      this.router.navigate(['dashboard']);
      
    })
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

  /* logout */
  async logout() {
    var result = null;

    /* sign out the user from fire authentication */
    await signOut(this.auth)
    .then(() => {
      this.router.navigate(['login']);
    })
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

  /* Updates the data for a user. If the user's data does not exist, it will be created */
  async setUserData(email: string, displayName: string, photoURL: string) {
    var result = null;

    /* get user auth uid */
    const userId = this.auth.currentUser?.uid;

    /* will never be undefined but still checking */
    if (userId != undefined) {

      /* create custom document references */
      const userDoc = doc(this.firestore, `users/${userId}`).withConverter(userDataConverter);

      const newUserData: UserData = {
        email: email, 
        displayName: displayName,
        photoURL: photoURL,
        uid: userId
      };

      /* Note that in this case, setDoc will create new documents */
      /* first we add the new user to the database under 'users' */
      await setDoc(userDoc, newUserData)
      .catch((error) => {
        /* one error to check if the case where the user already exists */
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

  /* Updates the status of a user. If the user's status does not exist, it will be created */
  async setStatus(status: string) {
    var result = null;
    const userId = this.auth.currentUser?.uid;

    /* create custom document reference */
    const statusDoc = doc(this.firestore, `status/${userId}`).withConverter(userStatusConverter);

    const newUserStatus: UserStatus = {
      online: true
    }

    /* now upodate the status of the user */
    await setDoc(statusDoc, newUserStatus)
    .catch((error) => {
      /* one error to check if the case where the user already exists */
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