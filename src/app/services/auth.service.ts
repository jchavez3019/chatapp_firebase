import { Injectable, OnDestroy, Query, inject } from '@angular/core';
import { Auth, authState, User, user, createUserWithEmailAndPassword, UserCredential, updateProfile, AuthSettings, signInWithEmailAndPassword, signOut, UserProfile, onAuthStateChanged, Unsubscribe } from '@angular/fire/auth';
import { Firestore, setDoc, doc, query, collection, where, getDocs, QuerySnapshot, updateDoc, DocumentReference, FirestoreError, addDoc } from '@angular/fire/firestore';
import { Router } from '@angular/router';

/* firebase data types */
import { UserData, UserStatus, userDataConverter, userStatusConverter } from '../firestore.datatypes';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {

  private auth: Auth = inject(Auth);

  /*
    A quick note on this practice, subjects in services should typically be private. This is because
    only the service should be allowed to publish data (use next()) on subjects. Making these subjects
    public allow others importing the subject to now publish data on the subject. The better practice which
    I use is to also create an observable instance of the subejct that is public. That way any other
    component or service importing the observable cannot publish to the subject's stream, essentially
    enforcing a read-only behavior on the stream to others. 
  */
  /* private subjects */
  private authUserSubject: BehaviorSubject<User | null | undefined> = new BehaviorSubject<User | null | undefined>(this.auth.currentUser);
  private hasAuthSignedInSubject: BehaviorSubject<Boolean> = new BehaviorSubject<Boolean>(false);

  /* public observables */
  authUsersObservable: Observable<User | null | undefined> = this.authUserSubject.asObservable();
  hasAuthSignedInObservable: Observable<Boolean> = this.hasAuthSignedInSubject.asObservable();

  private firestore: Firestore = inject(Firestore);

  /* subscriptions */
  private unsubscribeOnAuthStateChanged: Unsubscribe | null = null;

  constructor(private router: Router) {


    /* observes the state of the current user */
    this.unsubscribeOnAuthStateChanged = onAuthStateChanged(this.auth, (credential: User | null) => {
      if (credential) {
        this.authUserSubject.next(credential);
        this.hasAuthSignedInSubject.next(true);
        console.log(`User has logged in with displayName ${credential.displayName} and email ${credential.email}`);
      }
      else {
        this.authUserSubject.next(null);
        this.hasAuthSignedInSubject.next(false);
        console.log("User has logged out and is now null");
      }
    });
    
  }

  ngOnDestroy(): void {
    if (this.unsubscribeOnAuthStateChanged != null) {
      this.unsubscribeOnAuthStateChanged();
      this.unsubscribeOnAuthStateChanged = null;
    }
  }

  authUserLoggedIn() : Boolean {
    const authUserSubjectLast: User | null | undefined = this.authUserSubject.getValue();

    if (typeof(authUserSubjectLast) == null || typeof(authUserSubjectLast) == undefined)
      return false;
    else
      return true;
  }

  /* sign up */
  signUp(usercreds: any) : Promise<void> {

    var result = null;

    return new Promise((resolve, reject) => {
      /* from new firebase documenation */
      createUserWithEmailAndPassword(this.auth, usercreds.email, usercreds.password)
      .then((userCredential) => {
        /* at this point the user is signed in and the new user is returned as userCredential */
        // console.log(userCredential);

        /* update the current user */
        const prom1 = this.auth.updateCurrentUser(userCredential.user);

        /* update the profile of the newly created user */
        const prom2 = updateProfile(userCredential.user, {
          displayName: usercreds.displayName,
          photoURL: "https://www.pngall.com/wp-content/uploads/5/Profile-Male-PNG-Free-Download.png"
        });

        /* now create the user's data */
        const prom3 = this.setUserData(usercreds.email, usercreds.displayName, "https://www.pngall.com/wp-content/uploads/5/Profile-Male-PNG-Free-Download.png");

        /* now update the user's status */
        const prom4 = this.setStatus("online");

        Promise.all([prom1, prom2, prom3, prom4])
        .then(() => {
          /* navigate to the dashboard and resolve */
          this.router.navigate(['dashboard']);

          resolve();
        })
        .catch((error) => {
          /* error with one of the four promises */
          reject(error)
        });

        

      })
      .catch((error) => {
        /* one error to check if the case where the user already exists */
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log("error code: " + errorCode + " with msg: " + errorMessage);
        result = errorCode;
      });
    });

  }

  /* login */
  async login(usercreds: any) {

    var result;

    await signInWithEmailAndPassword(this.auth, usercreds.email, usercreds.password)
    .then((userCredential) => {
      const user = userCredential.user;

      /* update the current user */
      this.auth.updateCurrentUser(user);

      /* update the user's status */
      this.setStatus("online")
      .catch((error) => console.log("Error setting status with message: \n" + error.message));

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
  async logout(): Promise<void> {

    return new Promise<void>(async (resolve, reject) => {

      /* set the status of the user to offline */
      await this.setStatus("offline")
      .catch((error) => reject(error));

      /* logout the user */
      await signOut(this.auth)
      .catch((error) => reject(error));

      resolve();

    });

  }

  /* Updates the data for a user. If the user's data does not exist, it will be created */
  setUserData(email: string, displayName: string, photoURL: string) : Promise<void> {

    return new Promise<void>((resolve, reject) => {

      const userId: string = <string>this.auth.currentUser?.uid;

      /* create custom document references */
      const userDoc = doc(this.firestore, `users/${userId}`).withConverter(userDataConverter);

      const newUserData: UserData = {
        email: email, 
        displayName: displayName,
        lowercaseName: displayName.toLowerCase(),
        photoURL: photoURL,
        uid: userId
      };

      /* Note that in this case, setDoc will create new documents */
      /* first we add the new user to the database under 'users' */
      setDoc(userDoc, newUserData)
      .then(() => {
        resolve();
      })
      .catch((error) => reject(error));
      
    });

  }

  /* Updates the status of a user. If the user's status does not exist, it will be created */
  setStatus(status: string) : Promise<void> {

    return new Promise<void> ((resolve, reject) => {

      let isOnline: Boolean = false;
      if (status === "online")
        isOnline = true;
      else if (status === "offline")
        isOnline = false;
      else
        reject("Invalid status; Status should either be 'online' or 'offline'");

      const userStatusQuery = query<UserStatus>(collection(this.firestore, "status").withConverter(userStatusConverter), where("email","==", this.auth.currentUser?.email));
      getDocs(userStatusQuery)
      .then((userStatus_snapshot: QuerySnapshot<UserStatus>) => {

        if (userStatus_snapshot.size == 0) {
          /* user status document does not exist, it must be created */
          addDoc(collection(this.firestore, "status").withConverter(userStatusConverter), {
            "email": this.auth.currentUser?.email,
            "online": isOnline
          })
          .then(() => {
            resolve();
          })
          .catch((error: FirestoreError) => {
            reject(error);
          })
        }
        else if (userStatus_snapshot.size > 1) {
          /* user should not have multiple status documents */
          reject(`Current user has too many [${userStatus_snapshot.size}] status documents`);
        }
        else {
          const docRef: DocumentReference = doc(this.firestore, `status/${userStatus_snapshot.docs[0].id}`);
          updateDoc(docRef, { ["online"]: isOnline })
          .then(() => {
            resolve();
          })
          .catch((error: FirestoreError) => {
            reject(error);
          });
        }
      })
      .catch((error: FirestoreError) => {
        reject(error);
      });

    });

  }


}