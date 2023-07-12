import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { Unsubscribe } from '@angular/fire/auth';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription } from 'rxjs';

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

  private suggestedUsers: UserData[] = [];
  usersToAdd: UserData[] = [];
  private unsubUsers: Unsubscribe | undefined = undefined;

  private userIsSearching: Boolean = false;

  /* subscriptions */
  private suggestionsSubjectSubscription: Subscription | null = null;


  constructor(private userService: UserService, private requestsService: RequestsService, private suggestionsService: SuggestionsService ,private snackBar: MatSnackBar) { }

  ngOnInit(): void {

    /* grabs suggested users */
    this.suggestionsSubjectSubscription = this.suggestionsService.suggestsObservable.subscribe(
      (updatedSuggestions: UserData[]) => {
        this.suggestedUsers = updatedSuggestions;
        if (this.userIsSearching === false) {
          this.usersToAdd = this.suggestedUsers;
        }
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
      // for (let i = 0; i < this.users.length; i++) {
      //   const currUserEmail = this.users[i].email;

      //   if (user.email === currUserEmail) {
      //     this.users.splice(i, 1);
      //     break;
      //   }
      // }


      /* display a message alerting that a request was successful */
      this.snackBar.open('Request Sent', 'Okay', { duration: 3000 });
    });
  }

  async instantSearch($event: any) {
      let q = $event.target.value;
      if (q != '') {
        /* if the user is trying to do a search, get the results and display them */
        this.userIsSearching = true;
        this.usersToAdd = await this.userService.instantSearch(q);
      }
      else {
        /* if the users is not trying to do a search, display the suggested users */
        this.userIsSearching = false;
        this.usersToAdd = this.suggestedUsers;
      }
  }

}