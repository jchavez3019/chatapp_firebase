import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

/* templates */
import { UserData, UserStatus } from 'src/app/firestore.datatypes';
import { FriendsService } from 'src/app/services/friends.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-my-friends',
  templateUrl: './my-friends.component.html',
  styleUrls: ['./my-friends.component.css']
})
export class MyFriendsComponent implements OnInit {

  userFriends: UserData[] = [];
  friendStatuses: UserStatus[] = [];

  private allFriendsSubjectSubscription: Subscription | null = null;
  private friendStatusesSubscription: Subscription | null = null;

  constructor(private friendsService: FriendsService, private usersService: UserService) { }

  ngOnInit(): void {

    /* subscribe to received updated friend's list for the current user */
    this.allFriendsSubjectSubscription = this.friendsService.allFriendsObservable.subscribe((updatedFriends: UserData[]) => {
      this.userFriends = updatedFriends;
    });

    this.allFriendsSubjectSubscription = this.usersService.friendStatusesObservable.subscribe(
      (userStatuses: UserStatus[]) => {

        /* initialize an array with all the friend emails in order but offline status */
        let newFriendStatuses: UserStatus[] = this.userFriends.map((currFriend: UserData) => {return {'email': currFriend.email, 'online': false}});

        /* filter results for online statuses and set them true in the newFriendStatuses array */
        userStatuses.filter((currUserStatus: UserStatus) => currUserStatus.online === true).forEach((currUserStatus: UserStatus) => {
          const idx = newFriendStatuses.findIndex((initFriendStatus) => initFriendStatus.email === currUserStatus.email);
          newFriendStatuses[idx].online = true;
        });

        /* copy over the new order list of online statuses */
        this.friendStatuses = newFriendStatuses;

      }
    );
  }

  ngOnDestory(): void {

    /* unsubscribe to allFriendsSubject */
    if (this.allFriendsSubjectSubscription != null) {
      this.allFriendsSubjectSubscription.unsubscribe();
      this.allFriendsSubjectSubscription = null;
    }

    if (this.friendStatusesSubscription != null) {
      this.friendStatusesSubscription.unsubscribe();
      this.friendStatusesSubscription = null;
    }
     
  }

}
