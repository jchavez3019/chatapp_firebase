// firestore datatypes

import { FirestoreDataConverter, DocumentData, QueryDocumentSnapshot } from "@angular/fire/firestore";

/***********************/
/*      Collections    */
/***********************/

/* users: UserData */

/* interface */
export interface UserData {
    displayName: string;
    email: string;
    photoURL: string;
    uid: string;
}

/* converter */
export const userDataConverter: FirestoreDataConverter<UserData> = {
    toFirestore(userData: UserData): DocumentData {
      console.log("userData Went through to-converter");
      return { ...userData};
    },
  
    fromFirestore(docSnap: QueryDocumentSnapshot): UserData {
      console.log("userData Went through from-converter")
      return docSnap.data() as UserData;
    },
  };

/* status: UserStatus */

/* interface */
export interface UserStatus {
    online: boolean;
}

/* convert */
export const userStatusConverter: FirestoreDataConverter<UserStatus> = {
    toFirestore(userStatus: UserStatus): DocumentData {
        console.log("userStatus went through to-converter");
        return { ...userStatus };
    },

    fromFirestore(docSnap: QueryDocumentSnapshot): UserStatus {
        console.log("userStatus went through from-converter");
        return docSnap.data() as UserStatus;
    }
}