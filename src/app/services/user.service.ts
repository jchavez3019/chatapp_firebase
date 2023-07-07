import { Injectable, inject, OnDestroy, Query } from '@angular/core';
import { Auth, authState, User, user, createUserWithEmailAndPassword, UserCredential, updateProfile, AuthSettings, signInWithEmailAndPassword, signOut, Unsubscribe } from '@angular/fire/auth';
import { Firestore, collection, query, where, and, or, collectionData, addDoc, CollectionReference, DocumentReference, setDoc, doc, getDoc, getDocs, updateDoc, onSnapshot, DocumentSnapshot, snapToData, QuerySnapshot, QueryFilterConstraint, FirestoreError, DocumentData } from '@angular/fire/firestore';
import { Storage, UploadTask, uploadBytesResumable, ref, StorageReference, TaskEvent, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { BehaviorSubject } from 'rxjs';

/* firebase data interfaces */
import { UserData, UserStatus, requestDataConverter, userDataConverter, userStatusConverter } from '../firestore.datatypes';
import { add_component_users } from '../components/add-friends/add-friends.component';


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

  /* get users by email */
  getUsersByEmail() {
    
  }


  /* get absolutely all users */
  async getAbsoluteAllUsers(): Promise<UserData[]> {

    return new Promise((resolve, reject) => {
      /* get a reference to the collection of users */
      const userCollection = collection(this.firestore, 'users').withConverter(userDataConverter);

      getDocs(userCollection)
      .then((users_snapshot: QuerySnapshot<UserData>) => {
        let allUsers: UserData[] = [];
        for (let i = 0; i < users_snapshot.size; i++)
          allUsers.push(users_snapshot.docs[i].data());

        resolve(allUsers);
      })
      .catch((error: FirestoreError) => {
        reject(error);
      });
    });

  }

  /* gets all users that is not the current user or a friend of the current user */
  async getRelativeAllUsers(requestedUsers: add_component_users): Promise<Unsubscribe | undefined> {

    let return_unsub: Unsubscribe | undefined = undefined;

    /* query for the user's friends */
    const friendsCollectionRef = collection(this.firestore, "friends");
    const currUserFriendsQuery = query(friendsCollectionRef, where("email", "==", this.auth.currentUser?.email));

    await getDocs(currUserFriendsQuery)
    .then((async (snapshot: QuerySnapshot<DocumentData>) => {

      /* grabs the friends document id */
      let docId;

      /* user has no friends, need to create an empty friends doc */
      if (snapshot.empty) {

        await addDoc(friendsCollectionRef, { email: this.auth.currentUser?.email })
        .then((newDocRef: DocumentReference<DocumentData>) => {
          docId = newDocRef.id;
        });

      }
      else {
        docId = snapshot.docs[0].id;
      }


      /* get the collection to the user's friends  */
      const currFriendsCollectionRef = collection(this.firestore, `friends/${docId}/myFriends`);

      /* subscribe to the current user's friends */
      return_unsub = onSnapshot(currFriendsCollectionRef, {
        next: (snapshot_friends: QuerySnapshot<DocumentData>) => {

          function removeFriendsFromAllUsers (firestore: Firestore, userArr: UserData[]) : UserData[] {
            snapshot_friends.docChanges().forEach((change) => {
              if (change.type === "added") {
                /* remove them from the reference */
                const otherUserEmail = change.doc.data()['email'];

                for (let i = 0; i < userArr.length; i++) {
                  const currListUserEmail = userArr[i].email;

                  if (currListUserEmail === otherUserEmail) {
                    /* remove the user and move onto the next user */
                    userArr.splice(i, 1);
                    break;
                  }
                }
              }
              if (change.type === "modified") {
                // do nothing, don't care about modified pages
              }
              if (change.type === "removed") {
                /* add them to the reference */

                /* query removed friend */
                const getQuery = query<UserData>(collection(firestore, "users").withConverter(userDataConverter),
                where("email", "==", change.doc.data()['email']));
                
                getDocs<UserData>(getQuery)
                .then((snapshot: QuerySnapshot<UserData>) => {
                  /* append the removed friend to the reference */
                  userArr.push(snapshot.docs[0].data());
                })
                .catch((error: FirestoreError) => {
                  console.log("Error appending removed friend to reference");
                });
              }
            });

            return userArr;
          }

          /*
            If the reference has not been initialized, get the docs for all users.
            We only do this once since it is not imperative that the current user is 
            always updated about all the users. It would put a lot of work on Firebase,
            especially as the user size grows.
            NOTE: Would want to deprecate this function eventually and opt for a feature
            that only grabs a capped limit of users that the current user would most likely know
          */
          if (!requestedUsers.initialized) {
            /* declare the reference initialized */
            requestedUsers.initialized = true;

            /* get all the users except the current user */
            const allUsersCollectionRef = collection(this.firestore, "users").withConverter(userDataConverter);
            const getQuery = query(allUsersCollectionRef, where("email", "!=", this.auth.currentUser?.email));
            
            getDocs<UserData>(getQuery)
            .then((snapshot_final: QuerySnapshot<UserData>) => {
              /* grab all the filtered users */
              let finalUserDocs: UserData[] = [];

              for (let i = 0; i < snapshot_final.size; i++) {
                finalUserDocs.push(snapshot_final.docs[i].data());
              }

              /* appends all other users to the reference's request */
              // requestedUsers.users = finalUserDocs;

              /* now query all the requests that the current user has sent or recieved and filter those out */
              const requestQuery = query(collection(this.firestore, "requests").withConverter(requestDataConverter), or(where("sender","==", this.auth.currentUser?.email), where("receiver", "==", this.auth.currentUser?.email)));
              getDocs(requestQuery)
              .then((snapshot: QuerySnapshot<DocumentData>) => {

                /* filter users that are friends */
                removeFriendsFromAllUsers(this.firestore, finalUserDocs);

                /* iterate through the receivers/senders */
                for (let i = 0; i < snapshot.size; i++) {

                  const receiver = snapshot.docs[i].data()['receiver'];
                  const sender = snapshot.docs[i].data()['sender'];
                  const otherUserEmail = (receiver === this.auth.currentUser?.email) ? sender : receiver;

                  /* iterate through the users and remove entries that match the receiver/sender */
                  for (let j = 0; j < finalUserDocs.length; j++) {
                    const finalEmail = finalUserDocs[j].email;

                    /* remove the entry and move on to the next receiver/sender */
                    if (finalEmail === otherUserEmail) {
                      finalUserDocs.splice(j, 1);
                      break;
                    }
                  }
                  
                }

                /* finally update the reference with the updated list */
                requestedUsers.users = finalUserDocs;
              });
            })
            .catch((error: FirestoreError) => {
              console.log("Error in relative snapshot with name " + error.name + " and mesage " + error.message);
            });

          }  
          else {

            /* reference was initialized, now just add or remove users */
            requestedUsers.users = removeFriendsFromAllUsers(this.firestore, requestedUsers.users);
          }         

          
        },
        
        error: (error: FirestoreError) => {
          console.log("Error calling relative snapshot");
        }
      })




    }));

    return return_unsub;

  }

  /* instant search for add friend component */
  // instantSearch(startValue, endValue) {
  //   return this.afs.collection('users', ref=> )
  // }


}
