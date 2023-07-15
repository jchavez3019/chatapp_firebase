// firestore datatypes

import { FirestoreDataConverter, DocumentData, QueryDocumentSnapshot } from "@angular/fire/firestore";

/***********************/
/*      Collections    */
/***********************/

/* users: UserData */

/* interface */
export interface UserData {
    displayName: string;
    lowercaseName: string;
    email: string;
    photoURL: string;
    uid: string;
}

/* converter */
export const userDataConverter: FirestoreDataConverter<UserData> = {
    toFirestore(userData: UserData): DocumentData {
    //   console.log("userData Went through to-converter");
      return { ...userData};
    },
  
    fromFirestore(docSnap: QueryDocumentSnapshot): UserData {
    //   console.log("userData Went through from-converter")
      return docSnap.data() as UserData;
    },
  };

/* status: UserStatus */

/* interface */
export interface UserStatus {
    email: string;
    online: boolean;
}

/* convert */
export const userStatusConverter: FirestoreDataConverter<UserStatus> = {
    toFirestore(userStatus: UserStatus): DocumentData {
        // console.log("userStatus went through to-converter");
        return { ...userStatus };
    },

    fromFirestore(docSnap: QueryDocumentSnapshot): UserStatus {
        // console.log("userStatus went through from-converter");
        return docSnap.data() as UserStatus;
    }
}

/* requests: RequestData */

/* interface */
export interface RequestData {
    sender: string;
    receiver: string;
}

/* convert */
export const requestDataConverter: FirestoreDataConverter<RequestData> = {
    toFirestore(requestData: RequestData): DocumentData {
        // console.log("requrestData went through to-converter");
        return { ...requestData };
    },

    fromFirestore(docSnap: QueryDocumentSnapshot): RequestData {
        // console.log("requestData went through from-converter");
        return docSnap.data() as RequestData;
    }
}

/* requests: ConversationInfo */

/* interface */
export interface ConversationInfo {
    conversationID: string;
    messenger1: string;
    messenger2: string;
}

/* convert */
export const convserationInfoConverter: FirestoreDataConverter<ConversationInfo> = {
    toFirestore(conversationInfo: ConversationInfo): DocumentData {
        return { ...conversationInfo };
    },

    fromFirestore(docSnap: QueryDocumentSnapshot): ConversationInfo {
        return docSnap.data() as ConversationInfo;
    }
}

/* requests: MessageData */

/* interface */
export interface MessageData {
    message: string;
    senderEmail: string;
    date: string;
}

/* convert */
export const messageDataConverter: FirestoreDataConverter<MessageData> = {
    toFirestore(messageData: MessageData): DocumentData {
        // console.log("requrestData went through to-converter");
        return { ...messageData };
    },

    fromFirestore(docSnap: QueryDocumentSnapshot): MessageData {
        // console.log("requestData went through from-converter");
        return docSnap.data() as MessageData;
    }
}