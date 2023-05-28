import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestoreDocument, AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private authState: any;

  constructor(private afauth: AngularFireAuth, private afs: AngularFirestore, private router: Router) { 
    this.afauth.authState.subscribe((user) => {
      this.authState = user;
    })
  }

  get currentUserId(): string {
    return this.authState !== null ? this.authState.uid : '';
  }

  /* sign up */
  signUp(usercreds: any) {

    /* DEBUG */
    console.log("Logging in with the user: " + usercreds);
    console.log("email: " + usercreds.email + " pwd: " + usercreds.password);

    /* from the Firebase documentation */
    // return this.afauth.createUserWithEmailAndPassword(usercreds.email, usercreds.password)
    // .then((userCredential) => {

    //   /* at this point, the user is signed in and firebase has returned the user's new credentials */
    //   const user = userCredential.user;

    //   /* rest of user signed in code */
    //   // ...
    // })
    // .catch((error) => {
    //   /* basic error checking */
    //   const errorCode = error.code;
    //   const errorMessage = error.message;

    //   /* rest of error code */
    //   // ...
    // })

    /* from the tutorial */
    return this.afauth.createUserWithEmailAndPassword(usercreds.email, usercreds.password)
    .then((userCredential) => {
      /* at this point the user is signed in and the new user is returned as userCredential */
      console.log(userCredential);
      this.authState = userCredential;

      /* udpating with tutorial */
      this.updateProfile(usercreds.displayName);

      /* updating using firebase documentation */
      // this.afauth.updateCurrentUser
      
    })
    .catch((error) => {
      /* one error to check is the case where the user already exists */
      const errorCode = error.code;
      const errorMessage = error.message;
      console.log("error code: " + errorCode + " with msg: " + errorMessage);
    })
    .then(() => {
      /* now update this user locally */
      this.setUserData(usercreds.email, usercreds.displayName, usercreds.photoURL);
    });
  }

  async updateProfile(displayName: string) {
    const profile = {
      displayName: displayName,
      photoURL: "https://example.com/jane-q-user/profile.jpg"
  }
  return (await this.afauth.currentUser)?.updateProfile(profile);
  }

  /* set user data to a local users collections used to reference throughout the application */
  setUserData(email: string, displayName: string, photoURL: string) {
    /* DEBUG */
    console.log("Getting user from db");

    /* this returns information about the user from firestore */
    const path = `users/${this.currentUserId}`;
    const statuspath = `status/${this.currentUserId}`;
    const userdoc: any = this.afs.doc(path);
    const status_: any = this.afs.doc(statuspath);
    
    userdoc.set( {
      email: email,
      displayName: displayName,
      photoURL: photoURL
    });
    status_.set = ({
      status: 'online'
    });

    this.router.navigate(['dashboard']);
  }
}

