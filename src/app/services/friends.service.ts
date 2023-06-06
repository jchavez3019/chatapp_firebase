import { Injectable, inject } from '@angular/core';

/* firebase */
import { Auth, User } from '@angular/fire/auth';
import { Firestore, FirestoreError, where, collection, getDocs, query, DocumentData, QuerySnapshot } from '@angular/fire/firestore';

/* templates */
import { UserData, userDataConverter } from '../firestore.datatypes';

@Injectable({
  providedIn: 'root'
})
export class FriendsService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

  constructor() { }

  /* get the current user's friends */
  async getMyFriends() : Promise<UserData[]> {

    let allFriends: UserData[] = [];

    /* find the friends doc for the current user */
    const friendsQuery = query(collection(this.firestore, "friends"), where("email", "==", this.auth.currentUser?.email));
    await getDocs(friendsQuery)
    .then(async (friends_snapshot: QuerySnapshot<DocumentData>) => {

      /* get their sub collection of friends */
      const friendsSubCollectionRef = collection(this.firestore, `friends/${friends_snapshot.docs[0].id}/myFriends`);
      await getDocs(friendsSubCollectionRef)
      .then( async (subfriends_snapshot: QuerySnapshot<DocumentData>) => {
        
        /* array to hold promises */
        let subfriendPromises: Promise<void>[] = [];

        /* generate promises to retrieve each user that is a friend */
        for (let i = 0; i < subfriends_snapshot.size; i++) {
          const userQuery = query(collection(this.firestore, "users").withConverter(userDataConverter), where("email","==", subfriends_snapshot.docs[i].data()['email']));
          const userPromise = getDocs<UserData>(userQuery)
          .then((user_snapshot: QuerySnapshot<UserData>) => {
            allFriends.push(user_snapshot.docs[0].data());
          })
          .catch((error: FirestoreError) => {
            console.log("Error getting individual user from subcollection with head: " + error.name + " and message: " + error.message);
          });

          subfriendPromises.push(userPromise);
        }

        /* wait for all friends to be appended */
        await Promise.all(subfriendPromises);

      })
      .catch((error: FirestoreError) => {
        console.log("Error in getting users from friends subcollection with head: " + error.name + " and message: " + error.message);
      });
    })
    .catch((error: FirestoreError) => {
      console.log("Error getting subcollection of friends with head: " + error.name + " with message :" + error.message);
    });

    return allFriends;
  }
}
