import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Firestore, FirestoreError, QuerySnapshot, DocumentSnapshot } from '@angular/fire/firestore';
import { Unsubscribe, User, UserProfile } from '@angular/fire/auth';
import { MatSnackBar } from '@angular/material/snack-bar';

/* firestore data types */
import { UserData } from 'src/app/firestore.datatypes';
import { RequestsService } from 'src/app/services/requests.service';

@Component({
  selector: 'app-add-friends',
  templateUrl: './add-friends.component.html',
  styleUrls: ['./add-friends.component.css']
})
export class AddFriendsComponent implements OnInit, OnDestroy {

  users: add_component_users = { users: [], initialized: false };
  private unsubUsers: Unsubscribe | undefined = undefined;


  constructor(private userService: UserService, private requestsService: RequestsService ,private snackBar: MatSnackBar) { }

  ngOnInit(): void {

    /* call snapshot that updates all other users */
    this.userService.getRelativeAllUsers(this.users)
    .then((ret_unsub) => {
      if (ret_unsub != undefined)
        this.unsubUsers = ret_unsub;
    });

  }

  ngOnDestroy(): void {
    /* unsubscribe to the snapshot that looks for updates to the user collection */
    if (this.unsubUsers != undefined) {
      this.unsubUsers();
    }
  }

  addFriend(user: UserData) {
    this.requestsService.addRequest(user.email)
    .then(() => {

      /* now remove the user from the local users list */
      for (let i = 0; i < this.users.users.length; i++) {
        const currUserEmail = this.users.users[i].email;

        if (user.email === currUserEmail) {
          this.users.users.splice(i, 1);
          break;
        }
      }

      /* display a message alerting that a request was successful */
      this.snackBar.open('Request Sent', 'Okay', { duration: 3000 });
    });
  }

  instantSearch(event: any) {
    
  }

}

/* allows pass by reference */
export interface add_component_users {
  users: UserData[];
  initialized: boolean;
}