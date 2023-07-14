import { Injectable, inject, OnDestroy, Query } from '@angular/core';
import { Auth, authState, User, user, createUserWithEmailAndPassword, UserCredential, updateProfile, AuthSettings, signInWithEmailAndPassword, signOut, Unsubscribe, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, collection, query, where, and, or, collectionData, addDoc, CollectionReference, DocumentReference, setDoc, doc, getDoc, getDocs, updateDoc, onSnapshot, DocumentSnapshot, snapToData, QuerySnapshot, QueryFilterConstraint, FirestoreError, DocumentData, orderBy, startAt, endAt, limit, QueryDocumentSnapshot } from '@angular/fire/firestore';
import { Storage, UploadTask, uploadBytesResumable, ref, StorageReference, TaskEvent, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { BehaviorSubject, combineLatest, take, map, tap, filter, Subscription, Observable } from 'rxjs';

/* firebase data interfaces */
import { UserData, UserStatus, userDataConverter, userStatusConverter } from '../firestore.datatypes';
import { RequestsService } from './requests.service';
import { FriendsService } from './friends.service';
import { AuthService } from './auth.service';

const searchLimit = 20; // the number of users to return in a search

@Injectable({
  providedIn: 'root'
})
export class UserService implements OnDestroy {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private unsub: any;

  private storage: Storage = inject(Storage);

  authState$ = authState(this.auth);

  

  /* variables */
  private friendStatuses: UserStatus[] = [];

  /* private subjects */
  private friendStatusesSubject: BehaviorSubject<UserStatus[]> = new BehaviorSubject<UserStatus[]>([]);

  /* public observables */
  friendStatusesObservable: Observable<UserStatus[]> = this.friendStatusesSubject.asObservable();

  /* subscriptions */
  private onAuthStateChangedUnsubscribe: Unsubscribe | null = null;
  private allFriendsObservableSubscription: Subscription | null = null;
  private friendStatusesUnsubscribe: Unsubscribe | null = null;

  /* current user whose information will be displayed in the dashboard */
  /*NOTE: look into FirestoreConverter */
  currentUser: BehaviorSubject<UserData | undefined> = new BehaviorSubject<UserData | undefined>({
    displayName: "",
    lowercaseName: "",
    email: "",
    photoURL: "",
    uid: ""
  });


  constructor(private authService: AuthService, private requestsService: RequestsService, private friendsService: FriendsService) {

    this.onAuthStateChangedUnsubscribe = onAuthStateChanged(this.auth, (credential: User | null) => {
      if (credential) {
        /* perform initializations */
        console.log("logged in; performing user initialization");
        this.initializeAll();  
      } 
      else {
        /* user has signed out, need to reset everything */
        this.resetFields();
      }
    });

   }

   ngOnDestroy(): void {
    this.clearSubscriptions();
    this.resetFields();
  }

  initializeAll() {
    /* get the user's uid */
    const userId = this.auth.currentUser?.uid;

    /* create custom document references */
    const userDoc = doc(this.firestore, `users/${userId}`).withConverter(userDataConverter);

    /* using snapshot to get changes to the user document */
    this.unsub = onSnapshot(userDoc, {
      next: (doc_snapshot: DocumentSnapshot<UserData>) => {
        // console.log(doc_snapshot);

        /* if the snapshot is defined, emit the current user's profile data */
        if (doc_snapshot != undefined) {
          const updatedUserProfile: UserData | undefined = doc_snapshot.data();
          this.currentUser.next(updatedUserProfile);  
        }
      },
      error: (error) => {
        console.log("Error in snapshot: " + error);
      }
    });

    /* listens to updated friends and gets their online status */
    this.allFriendsObservableSubscription = this.friendsService.allFriendsObservable.subscribe((allFriends: UserData[]) => this.snapshotFriendStatuses(allFriends));
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

    /* blank emissions */
    this.currentUser.next(undefined);
    this.friendStatusesSubject.next([]);

    /* reset variables */
    this.friendStatuses = [];

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
    // when manually subscribing to an observable remember to unsubscribe in ngOnDestroy
    if (this.unsub != null) {
      this.unsub();
      this.unsub = null;
    }

    if (this.onAuthStateChangedUnsubscribe != null) {
      this.onAuthStateChangedUnsubscribe();
      this.onAuthStateChangedUnsubscribe = null;
    }

    if (this.allFriendsObservableSubscription != null) {
      this.allFriendsObservableSubscription.unsubscribe();
      this.allFriendsObservableSubscription = null;
    }

    if (this.friendStatusesUnsubscribe != null) {
      this.friendStatusesUnsubscribe();
      this.friendStatusesUnsubscribe = null;
    }
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

  /* update the profile picture of the current user */
  updateProfilePic(file: any) {

    /* gather necessary information */
    const userId = this.auth.currentUser?.uid;
    const fileStorageReference: StorageReference  = ref(this.storage, 'profilepics/'+userId);
    const uploadTask = uploadBytesResumable(fileStorageReference, file);

    /* check that the authenticated user is not null which realistically will never happen */
    if (this.auth.currentUser != null) {
      const currUser: User = this.auth.currentUser;

      uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log("Upload is " + progress + "% done");
        switch (snapshot.state) {
          case 'paused':
            break;
          case 'running':
            break;
        }
      },
      (error) => {
        // Handling unsuccessful uploads
      },
      () => {
        // Handle successful uploads on complete
        // For instance, get the download URL: https://firebasestorage.googleapis.com/...
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          console.log('File available at', downloadURL);

          /* update the usr's doc with the new photoURL */
          const userDoc = doc(this.firestore, `users/${userId}`);

          updateDoc(userDoc, { photoURL: downloadURL })
          .then(() => {
            /* the user's doc has been updated, now update the user's auth profile */
            updateProfile(currUser, {photoURL: downloadURL})
            .catch((error) => {
              /* error updating auth profile */
              const errorCode = error.code;
              const errorMessage = error.message;
              console.log("Error in uploading doc\nerror code: " + errorCode + " with msg: " + errorMessage);
            })

          })
          .catch((error) => {
            /* error updating doc */
            const errorCode = error.code;
            const errorMessage = error.message;
            console.log("Error in uploading doc\nerror code: " + errorCode + " with msg: " + errorMessage);
          });

          });

        }
      )
    }
  }

  /* get current user */
  getCurrentUser() : Promise<DocumentSnapshot<UserData>> {
    /* get user auth uid */
    const userId = this.auth.currentUser?.uid;

    /* create custom document references */
    const userDoc = doc(this.firestore, `users/${userId}`).withConverter(userDataConverter);

    /* return promise */
    return getDoc(userDoc);
  }


  /* Author: Jorge Chavez
  Description: Gets the online status from a list of users
  Inputs:
    users: UserData[] -- list of users from which to check online status
  Outputs:
    None:
  Returns:
    Promise<Boolean[]> -- Promise that returns online statuses once resolved
  Effects:
    None
  */
  getUserStatuses(users: UserData[]) : Promise<Boolean[]> {

    return new Promise((resolve, reject) => {
      let userStatuses: Boolean[] = Array(users.length).fill(false); // array of user statuses to return 
      let allUserPromises: Promise<void>[] = []; // individual promises for returning each user's status

      /* if no users are given, resolve with empty array */
      if (users.length == 0)
        resolve([]);

      /* creates individual promises for each user to get their status */
      users.forEach((currUser: UserData, currIndex: number) => {

        const currUserEmail = currUser.email;

        /* create a status query for the current user in the list */
        const userStatusQuery = query(collection(this.firestore, "status").withConverter(userStatusConverter), where("email", "==", currUserEmail));

        /* create a promise to ensure that a status was retrieved for the current user */
        const currProm: Promise<void> = new Promise<void>((prom_resolve, prom_reject) => {
          getDocs(userStatusQuery)
          .then((UserStatus_snapshot: QuerySnapshot<UserStatus>) => {
            if (UserStatus_snapshot.size === 0) {
              prom_reject("No status document exists for user with email: " + currUserEmail);
            }
            else if (UserStatus_snapshot.size > 1) {
              prom_reject("Multiple status documents exists for user with email: " + currUserEmail);
            }
            else {
              userStatuses[currIndex] = UserStatus_snapshot.docs[0].data()['online'];
              prom_resolve();
            }
          })
          .catch((error: FirestoreError) => prom_reject(error));
        });

        /* push the promise */
        allUserPromises.push(currProm);
    
      }); 

      /* once all individual user promises have been fulfilled, return all their statuses */
      Promise.all(allUserPromises)
      .then(() => resolve(userStatuses))
      .catch((error: FirestoreError) => reject(error));
    });

  }

  private snapshotFriendStatuses(users: UserData[]) {

    /* unsubscribe to the previous snapshot */
    if (this.friendStatusesUnsubscribe != null) {
      this.friendStatusesUnsubscribe();
      this.friendStatusesUnsubscribe = null;
    }

    /* return nothing since there are no friends to snapshot to */
    if (users.length == 0) {
      return;
    }

    const userEmails: string[] = users.map((currUser) => currUser.email);

    const friendStatusQuery = query(collection(this.firestore, "status").withConverter(userStatusConverter), where("email", "in", userEmails));
    this.friendStatusesUnsubscribe = onSnapshot(friendStatusQuery,
      (friendStatus_snapshot: QuerySnapshot<UserStatus>) => {

        /* look for only added and modified document changes */
        friendStatus_snapshot.docChanges().forEach((statusChange) => {
          if (statusChange.type === "added") {
            /* adds user statuses */
            this.friendStatuses.push({
              "email": statusChange.doc.data()['email'],
              "online": statusChange.doc.data()['online']
            });
            this.friendStatusesSubject.next(this.friendStatuses);
          }
          if (statusChange.type === "modified") {
            /* modified user statuses */
            const modifiedStatus: UserStatus = statusChange.doc.data();
            const idx = this.friendStatuses.map((friendUserStatus) => friendUserStatus.email).findIndex((email) => email === modifiedStatus.email);
            this.friendStatuses[idx].online = modifiedStatus.online;
            this.friendStatusesSubject.next(this.friendStatuses);
          }
        });

    });

  }

  /* instant search for add friend component */
  async instantSearch(textSearch: string) {

    let searchResults: UserData[] = [];
    await getDocs(query(collection(this.firestore, 'users').withConverter(userDataConverter), orderBy("lowercaseName"), startAt(textSearch), endAt(textSearch + '\uf8ff'), limit(searchLimit) ))
    .then((searched_snapshot: QuerySnapshot<UserData>) => {
      combineLatest([this.requestsService.receivedRequestsObservable, this.requestsService.sentRequestsObservable, this.friendsService.allFriendsObservable])
      .pipe(
        take(1),
        map(([receivedRequests, sentRequests, allFriends]) => Array(...receivedRequests, ...sentRequests, ...allFriends).map((user_data: UserData) => user_data.email)),
      )
      .subscribe((nonSearchableUsers: string[]) => {
        searched_snapshot.forEach((user_doc: QueryDocumentSnapshot<UserData>) => {
          const userData = user_doc.data();
          if (!nonSearchableUsers.includes(userData.email) && (this.auth.currentUser?.email !== userData.email))
            searchResults.push(userData);
        });
      });
    })
    .catch((error: FirestoreError) => {
      console.log("Error searching for users with message: " + error.message);
    });

    return searchResults;
  }

  unsubscribeAll() {
    if (this.unsub != null) {
      this.unsub();
      this.unsub = null;
    }
  }


}
