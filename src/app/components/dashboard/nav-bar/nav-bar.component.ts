import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { FriendsService } from 'src/app/services/friends.service';
import { RequestsService } from 'src/app/services/requests.service';
import { SuggestionsService } from 'src/app/services/suggestions.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-nav-bar',
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent implements OnInit {

  constructor(private router: Router, 
    private auth: AuthService,
    private requestsService: RequestsService,
    private userService: UserService,
    private friendsService: FriendsService,
    private suggestionsService: SuggestionsService) { }

  ngOnInit(): void {
  }

  /*
  Description:
    Logs out the current user from the application and returns them to the login page.
  Inputs:
    None
  Outputs:
    None
  Returns:
    None
  Effects:
    Logs out the current user from the application and from Firestore
  */
  logoutButton() {

    /* need to unsubscribe from all subjects and snapshots */
    this.requestsService.unsubcribeAll();
    this.userService.unsubscribeAll();
    this.friendsService.unsubscribeAll();
    this.suggestionsService.unsubscribeAll();

    this.auth.logout()
    .then(()=> {
      /* once the service takes care of ending background tasks, can navigate back to login*/
      this.router.navigate(['login']);
    })
    .catch((error) => {
      console.log("Error logging out with message: \n" + error.message);
    });
  }

}
