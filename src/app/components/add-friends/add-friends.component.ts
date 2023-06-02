import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Firestore, FirestoreError, QuerySnapshot } from '@angular/fire/firestore';
import { Unsubscribe, User, UserProfile } from '@angular/fire/auth';

@Component({
  selector: 'app-add-friends',
  templateUrl: './add-friends.component.html',
  styleUrls: ['./add-friends.component.css']
})
export class AddFriendsComponent implements OnInit, OnDestroy {

  users: any;
  private unsubUsers: Unsubscribe | undefined;
  private currUser: User | undefined;


  constructor(private userService: UserService) { }

  ngOnInit(): void {

    /* get the current user */


    /* create observable function that returns all other users */
    let observerFunction = {
      next: (snapshot: QuerySnapshot<User>) => {
        let currentUserData = [];

        for (let i = 0; i < snapshot.size; i++) {
          /* skip the current user */
          let currCollectionUser = snapshot.docs[i].data();

          /* skip if the user matches the current user */
          // if (this.auth.currentUser == currCollectionUser)
          //   continue;

          /* append the users */
          currentUserData.push(snapshot.docs[i].data());
        }

        this.users = currentUserData;
      },
      error: (error: FirestoreError) => {
        console.log(error);
      }
    };

    /* call snapshot that updates all other users */
    this.unsubUsers = this.userService.getAllUsers(observerFunction);
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