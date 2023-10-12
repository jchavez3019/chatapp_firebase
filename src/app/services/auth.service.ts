import { Injectable, OnDestroy, Query, inject } from '@angular/core';
import { Auth, authState, User, user, createUserWithEmailAndPassword, UserCredential, updateProfile, AuthSettings, signInWithEmailAndPassword, signOut, UserProfile, onAuthStateChanged, Unsubscribe } from '@angular/fire/auth';
import { Firestore, setDoc, doc, query, collection, where, getDocs, QuerySnapshot, updateDoc, DocumentReference, FirestoreError, addDoc } from '@angular/fire/firestore';
import { DataSnapshot, Database, DatabaseReference, OnDisconnect, onDisconnect, onValue, ref, set } from '@angular/fire/database';
import { Router } from '@angular/router';

/* firebase data types */
import { UserData, UserStatus, userDataConverter, userStatusConverter } from '../firestore.datatypes';
import { BehaviorSubject, Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService implements OnDestroy {

  private auth: Auth = inject(Auth);
  private database: Database = inject(Database);
  private onDisconnectObj: OnDisconnect | null = null;
  private onRealtimeStatusUnsubscribe: Unsubscribe | null = null;

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
  private hasAuthSignedInSubject: BehaviorSubject<boolean | null> = new BehaviorSubject<boolean | null>(null);

  /* public observables */
  authUsersObservable: Observable<User | null | undefined> = this.authUserSubject.asObservable();
  hasAuthSignedInObservable: Observable<boolean | null> = this.hasAuthSignedInSubject.asObservable();

  private firestore: Firestore = inject(Firestore);

  /* subscriptions */
  private unsubscribeOnAuthStateChanged: Unsubscribe | null = null;

  constructor(private router: Router) {

    /* observes the state of the current user */
    this.unsubscribeOnAuthStateChanged = onAuthStateChanged(this.auth, (credential: User | null) => {
      if (credential) {
        this.authUserSubject.next(credential);
        this.hasAuthSignedInSubject.next(true);
        this._connectionSnapshot();
        // console.log(`User has logged in with displayName ${credential.displayName} and email ${credential.email}`);
      }
      else {
        this.authUserSubject.next(null);
        this.hasAuthSignedInSubject.next(false);
        // console.log("User has logged out and is now null");
      }
    });
    
  }

  ngOnDestroy(): void {
    if (this.unsubscribeOnAuthStateChanged != null) {
      this.unsubscribeOnAuthStateChanged();
      this.unsubscribeOnAuthStateChanged = null;
    }

    if (this.onRealtimeStatusUnsubscribe != null) {
      this.onRealtimeStatusUnsubscribe();
      this.onRealtimeStatusUnsubscribe = null;
    }
      

    /* sign out the user if they logged in */
    this.logout();
  }

  /* 
  Description:
    Checks if a user is currently logged in 
  Inputs:
    None
  Outputs:
    None
  Returns:
    boolean -- true if a user is logged in, false otherwise
  Effects:
    None
  */
  authUserLoggedIn() : Boolean {
    if ((this.auth.currentUser == null) || this.auth.currentUser == undefined) {
      return false;
    }
    else {
      return true;
    }
  }

  /*
  Description:
    Signs up a new user for the application.
  Inputs:
    usercreds: any -- all the infromation needed for sign up
  Outputs:
    None
  Returns:
    Promse<void> -- a resolved promise once the user has been signed up
  Effects:
    Adds user to Firestore
  */
  signUp(usercreds: any) : Promise<void> {

    return new Promise(async (resolve, reject) => {

        /* if a user is already logged in, log them out before creating a new user */
        if (this.authUserLoggedIn()) {
          await this.logout()
          .catch((error) => reject(error));
        }

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
          const prom3 = this._setUserData(usercreds.email, usercreds.displayName, "https://www.pngall.com/wp-content/uploads/5/Profile-Male-PNG-Free-Download.png");

          Promise.all([prom1, prom2, prom3])
          .then(() => {
            resolve();
          })
          .catch((error) => {
            /* error with one of the four promises */
            console.error(error);
            reject(error)
          });
        })
        .catch((error) => {
          const errorCode = error.code;
          const errorMessage = error.message;
          reject("error code: " + errorCode + " with msg: " + errorMessage);
        })
      });

  }

  /*
  Description:
    Given a user's credentials, log in
  Inputs:
    usercreds: any -- information of the user's credentials necessary for login
  Outputs:
    None
  Returns:
    Promise<void> -- a resolved promise once the user has logged in
  Effects:
    Logs in the user into the application allowing all other services to function
  */
  login(usercreds: any): Promise<void> {

    return new Promise(async (resolve, reject) => {

      /* if a user is already logged in, log them out before creating a new user */
      if (this.authUserLoggedIn()) {
        // console.log(`logging out ${this.auth.currentUser} before logging in ${usercreds.email}`)
        await this.logout()
        .catch((error) => {
          console.error(error);
          reject(error);
        });
      }

      signInWithEmailAndPassword(this.auth, usercreds.email, usercreds.password)
      .then((userCredential) => {
        const user = userCredential.user;
        /* update the current user */
        this.auth.updateCurrentUser(user)
        .then(() => {
          
          resolve();

        })
        .catch((error) => {
          console.error(error);
          reject("error updating current auth user with message: \n" + error.message);
      });
  
      })
      .catch((error) => {
        console.error(error);
        reject(error);
      });
    });

  }

  /*
  Description:
    Logs out the currently logged in user.
  Inputs:
    None
  Outputs:
    None
  Returns:
    Promse<void> -- resolves once the user has been successfully logged out
  Effects:
    Logs out the current user, disabling all functionality until a new user logs in
  */
  logout(): Promise<void> {

    return new Promise<void>((resolve, reject) => {

      this.setRealtimeStatus("offline")
      .then(() => {

        this.cancelOnDisconnect()
        .then(() => {

          if (this.onRealtimeStatusUnsubscribe == null) {
            console.error("onRealtimeStatus snapshot was never created");
            reject("onRealtimeStatus snapshot was never created");
          }
          else {
            this.onRealtimeStatusUnsubscribe();
            this.onRealtimeStatusUnsubscribe = null;
            signOut(this.auth);
            resolve();
          }
          
        })
        .catch((error) => {
          console.error(error);
          reject(error);
        });

      })
      .catch((error) => {
        console.error(error);
        reject(error);
      });

      
    })
    .catch(error => {
      console.error(error);
    });
  }

  /*
  Description:
    Helper function for creating a new user with their data in Firestore or updating their data
    if they already exist.
  Inputs:
    email: string -- user email
    displayName: string -- username
    photoURL: string -- profile picture URL
  Outputs:
    None
  Returns:
    Promise<void> -- resolved once successfully set
  Effects:
    Updates or creates user in Firestore
  */
  private _setUserData(email: string, displayName: string, photoURL: string) : Promise<void> {

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
      .catch((error) => {
        console.error(error);
        reject(error)
      });
      
    });

  }

  /*
  Description:
    Sets the status of the current user in the Firestore Realtime database
  Inputs:
    status: string -- the new status of the user
  Outputs:
    None
  Returns:
    Promise<string> -- a resolved promise containing the document path of the user's status
  Effects:
    Updates or creates a status document for a specified user
  */
  setRealtimeStatus(status: string) : Promise<string> {
    return new Promise<string> ((resolve, reject) => {
      let isOnline: Boolean = false;

      if (status === "online")
        isOnline = true;
      else if (status === "offline")
        isOnline = false;
      else
        reject("Invalid realtime status; Status should be either 'online' or 'offline'");

      const newDocData = {
        "email": this.auth.currentUser?.email,
        "online": isOnline
      }
      const docPath = `status/${this.auth.currentUser?.uid}`
      const docRef: DatabaseReference = ref(this.database, docPath);

      set(docRef, newDocData).then(() => {
        resolve(docPath);
      })
      .catch((error) => {
        console.error(error);
        reject(error);
      });

    });
  }

  /*
    
  Description:
    Gets called whenever the user logs in due to the onAuthChanged method which checks the new auth subscription.
    If the user has logged in successfully, then their status gets set to online in the Firestore Realtime database
    and we set up a callback function to set the status as offline if the application disconnects from Firestore.
  Inputs:
    None
  Outputs:
    None
  Returns:
    None
  Effects:
    Sets status to 'online' in the Firestore Realtime database
    Sets callback function for setting status to 'offline' when the application disconnects
  */
  private _connectionSnapshot() : void {

    /* this function was called before, no need to recreate the realtime status snapshot */
    if (this.onRealtimeStatusUnsubscribe != null) {
      return;
    }

    /* subscribe to value changes on '.info/connected' which indicates if a user is connected to realtime firebase*/
    this.onRealtimeStatusUnsubscribe = onValue(ref(this.database, '.info/connected'), (data_snapshot: DataSnapshot) => {
      /* if the user is offline, return */
      if (data_snapshot.val() === 'false') 
        return;
      

      const dbRef = ref(this.database, `status/${this.auth.currentUser?.uid}`);
      this.onDisconnectObj = onDisconnect(dbRef);
      this.onDisconnectObj.set({
        "email": this.auth.currentUser?.email,
        "online": false
      })
      .then(() => {
        this.setRealtimeStatus('online');
      })
      .catch((error) => console.error(error));

    }, 
    (error: Error) => {
      console.error(error);
    });

    return;

  }

  /*
  Description:
    Callback function to be used when the application disconnects from Firestore. Is used to set the 
    current user's status as 'offline'. 
  Inputs:
    None
  Outputs:
    None
  Returns:
    Promise<void> -- Resolves once the Firestore hook has been successfully set
  Effects:
    Sets callback that will be called on application disconnect unless removed
  */
  cancelOnDisconnect() : Promise<void> {

    return new Promise<void> ((resolve, reject) => {
      if (this.onDisconnectObj != null) {
        this.onDisconnectObj.cancel()
        .then(() => {
          /* after cancelling, this object to null and resolve */
          this.onDisconnectObj = null;
          resolve();
        })
        .catch((error) => {
          console.error(error);
          reject(error);
        });
      }
      else {
        /* if object was null, onDisconnect was already cancelled so we can resolve right away */
        resolve();
      }
      
    });
    
  }


}