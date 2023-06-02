import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Firestore, FirestoreError, QuerySnapshot, DocumentSnapshot } from '@angular/fire/firestore';
import { Unsubscribe, User, UserProfile } from '@angular/fire/auth';

/* firestore data types */
import { UserData } from 'src/app/firestore.datatypes';

@Component({
  selector: 'app-add-friends',
  templateUrl: './add-friends.component.html',
  styleUrls: ['./add-friends.component.css']
})
export class AddFriendsComponent implements OnInit, OnDestroy {

  users: Array<UserData> | undefined;
  private unsubUsers: Unsubscribe | undefined;


  constructor(private userService: UserService) { }

  ngOnInit(): void {

    /* get the current user */
    this.userService.getCurrentUser()
    .then((snapshot: DocumentSnapshot<UserData>) => {

      /* get the current user's id */
      const currUserUID = snapshot.data()?.uid;

      /* create observable function that returns all other users */
      let observerFunction = {
        next: (snapshot: QuerySnapshot<UserData>) => {
          let currentUserData = [];

          for (let i = 0; i < snapshot.size; i++) {
            /* skip the current user */
            let currCollectionUser = snapshot.docs[i].data();

            /* skip if the user matches the current user */
            if (currUserUID == currCollectionUser.uid)
              continue;

            /* append the users */
            currentUserData.push(snapshot.docs[i].data());
          }

          this.users = currentUserData;

          /* DEBUG */
          console.log("currAuthUser: " + typeof(currUserUID));
          console.log(currUserUID);
          console.log("listAllUsers: " + typeof(this.users[6]));
          console.log(this.users[6]);
        },
        error: (error: FirestoreError) => {
          console.log(error);
        }
      };

      /* call snapshot that updates all other users */
      this.unsubUsers = this.userService.getAllUsers(observerFunction);

    });

    

    
  }

  ngOnDestroy(): void {
    /* unsubscribe to the snapshot that looks for updates to the user collection */
    if (this.unsubUsers != undefined) {
      this.unsubUsers();
    }
  }

  addFriend(user: any) {
    return;
  }

}