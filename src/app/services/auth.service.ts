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
    return this.afauth.createUserWithEmailAndPassword(usercreds.email, usercreds.password)
    .then((user) => {
      this.authState = user;
      this.updateProfile(usercreds.displayName);
      
    })
    .then(() => {
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

