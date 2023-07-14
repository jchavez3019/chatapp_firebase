import { Injectable, inject, OnDestroy, Query } from '@angular/core';
import { Auth, authState, User, user, createUserWithEmailAndPassword, UserCredential, updateProfile, AuthSettings, signInWithEmailAndPassword, signOut, Unsubscribe, onAuthStateChanged } from '@angular/fire/auth';
import { Firestore, collection, query, where, and, or, collectionData, addDoc, CollectionReference, DocumentReference, setDoc, doc, getDoc, getDocs, updateDoc, onSnapshot, DocumentSnapshot, snapToData, QuerySnapshot, QueryFilterConstraint, FirestoreError, DocumentData, orderBy, startAt, endAt, limit, QueryDocumentSnapshot } from '@angular/fire/firestore';
import { Storage, UploadTask, uploadBytesResumable, ref, StorageReference, TaskEvent, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { BehaviorSubject, combineLatest, take, map, tap, filter, Subscription } from 'rxjs';

/* firebase data interfaces */
import { UserData, userDataConverter } from '../firestore.datatypes';
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

  /* subscriptions */
  private onAuthStateChangedUnsubscribe: Unsubscribe | null = null;

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
    this.currentUser.next(undefined);
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

  /* get users by email */
  getUsersByEmail() {
    
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
