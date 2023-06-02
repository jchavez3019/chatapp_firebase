import { Injectable, inject, OnDestroy } from '@angular/core';
import { Auth, authState, User, user, createUserWithEmailAndPassword, UserCredential, updateProfile, AuthSettings, signInWithEmailAndPassword, signOut, Unsubscribe } from '@angular/fire/auth';
import { Firestore, collection, collectionData, addDoc, CollectionReference, DocumentReference, setDoc, doc, getDoc, updateDoc, onSnapshot, DocumentSnapshot, snapToData, QuerySnapshot, FirestoreError, DocumentData } from '@angular/fire/firestore';
import { Storage, UploadTask, uploadBytesResumable, ref, StorageReference, TaskEvent, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { BehaviorSubject } from 'rxjs';

/* firebase data interfaces */
import { UserData, UserStatus, userDataConverter, userStatusConverter } from '../firestore.datatypes';


@Injectable({
  providedIn: 'root'
})
export class UserService implements OnDestroy {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private unsub: any;

  private storage: Storage = inject(Storage);

  authState$ = authState(this.auth);
  authStateSubscription: any;

  /* current user whose information will be displayed in the dashboard */
  /*NOTE: look into FirestoreConverter */
  currentUser: BehaviorSubject<UserData | undefined> = new BehaviorSubject<UserData | undefined>({
    email: "",
    displayName: "",
    photoURL: "",
    uid: ""
  });


  constructor() {
    /* userful for handling auth state chanegs */
    this.authStateSubscription = this.authState$.subscribe((aUser: User | null) => {
      // this.currentUser.next(aUser);
    });

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


  /* get all users */
  getAllUsers(observererFunction: any): Unsubscribe {
    /* get a reference to the collection of users */
    const userCollection = collection(this.firestore, 'users');

    /* create snapshot using the specificed observer functions and return unsubscribe */
    return onSnapshot(userCollection, observererFunction);
  }


}
