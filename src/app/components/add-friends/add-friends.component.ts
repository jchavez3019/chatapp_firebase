import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Firestore, FirestoreError, QuerySnapshot, DocumentSnapshot } from '@angular/fire/firestore';
import { Unsubscribe, User, UserProfile } from '@angular/fire/auth';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject, Subscription, combineLatest, pipe, take } from 'rxjs';

/* firestore data types */
import { UserData } from 'src/app/firestore.datatypes';
import { RequestsService } from 'src/app/services/requests.service';
import { SuggestionsService } from 'src/app/services/suggestions.service';

@Component({
  selector: 'app-add-friends',
  templateUrl: './add-friends.component.html',
  styleUrls: ['./add-friends.component.css']
})
export class AddFriendsComponent implements OnInit, OnDestroy {

  // users: add_component_users = { users: [], initialized: false };
  users: UserData[] = [];
  private unsubUsers: Unsubscribe | undefined = undefined;

  startAt = new Subject();
  endAt = new Subject();

  /* subscriptions */
  private suggestionsSubjectSubscription: Subscription | null = null;


  constructor(private userService: UserService, private requestsService: RequestsService, private suggestionsService: SuggestionsService ,private snackBar: MatSnackBar) { }

  ngOnInit(): void {

    /* call snapshot that updates all other users */
    // this.userService.getRelativeAllUsers(this.users)
    // .then((ret_unsub) => {
    //   if (ret_unsub != undefined)
    //     this.unsubUsers = ret_unsub;
    // });

    /* grab all existing users once */
    // this.userService.getAbsoluteAllUsers()
    // .then((allUsers: UserData[]) => {
    //   this.users = allUsers;
    // })
    // .catch((error) => {
    //   console.log("Error getting all users with message: " + error.message);
    // });

    /* grabs suggested users */
    this.suggestionsSubjectSubscription = this.suggestionsService.suggestsSubject.subscribe(
      (updatedSuggestions: UserData[]) => {
        this.users = updatedSuggestions;
        console.log("received updated suggestions");
      }
    );



  }

  ngOnDestroy(): void {
    /* unsubscribe to the snapshot that looks for updates to the user collection */
    if (this.unsubUsers != undefined) {
      this.unsubUsers();
    }

    /* unsubscribe to subjects */
    if (this.suggestionsSubjectSubscription != null)
      this.suggestionsSubjectSubscription.unsubscribe();
  }

  addFriend(user: UserData) {
    this.requestsService.addRequest(user.email)
    .then(() => {

      /* now remove the user from the local users list */
      for (let i = 0; i < this.users.length; i++) {
        const currUserEmail = this.users[i].email;

        if (user.email === currUserEmail) {
          this.users.splice(i, 1);
          break;
        }
      }

      /* display a message alerting that a request was successful */
      this.snackBar.open('Request Sent', 'Okay', { duration: 3000 });
    });
  }

  instantSearch($event: any) {
      // let q = $event.target.value;
      // if (q != '') {
      //   this.startAt.next(q);
      //   this.endAt.next(q + "\uf8ff");
      //   combineLatest([this.startAt, this.endAt]).pipe(take(1)).subscribe((value) => {
      //     this.userService.instantSearch(value[0], value[1]);
      //   })
      // }
  }

}

/* allows pass by reference */
export interface add_component_users {
  users: UserData[];
  initialized: boolean;
}