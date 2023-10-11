import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

/* templates */
import { UserData, UserStatus } from 'src/app/firestore.datatypes';
import { FriendsService } from 'src/app/services/friends.service';
import { MessagesService } from 'src/app/services/messages.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-my-friends',
  templateUrl: './my-friends.component.html',
  styleUrls: ['./my-friends.component.css']
})
export class MyFriendsComponent implements OnInit {

  userFriends: UserData[] = [];
  RTuserFriends: Map<String, String> = new Map<String ,String>();
  friendStatuses: UserStatus[] = [];
  RTFriendStatuses:  Map<String, String> = new Map<String, String>();

  private allFriendsSubjectSubscription: Subscription | null = null;
  private friendStatusesSubscription: Subscription | null = null;
  private RTFriendStatusesSubscription: Subscription | null = null;

  constructor(private friendsService: FriendsService, 
    private usersService: UserService,
    private messagesService: MessagesService) { }

  ngOnInit(): void {

    /* subscribe to received updated friend's list for the current user */
    this.allFriendsSubjectSubscription = this.friendsService.allFriendsObservable.subscribe((updatedFriends: UserData[]) => {
      this.userFriends = updatedFriends;
    });

    this.allFriendsSubjectSubscription = this.usersService.friendStatusesObservable.subscribe(
      (userStatuses: UserStatus[]) => {

        // /* initialize an array with all the friend emails in order but offline status */
        // let newFriendStatuses: UserStatus[] = this.userFriends.map((currFriend: UserData) => {return {'email': currFriend.email, 'online': false}});

        // /* filter results for online statuses and set them true in the newFriendStatuses array */
        // userStatuses.filter((currUserStatus: UserStatus) => currUserStatus.online === true).forEach((currUserStatus: UserStatus) => {
        //   const idx = newFriendStatuses.findIndex((initFriendStatus) => initFriendStatus.email === currUserStatus.email);
        //   newFriendStatuses[idx].online = true;
        // });

        // /* copy over the new order list of online statuses */
        // this.friendStatuses = newFriendStatuses;

      }
    );

    this.RTFriendStatusesSubscription = this.usersService.RTFriendStatusObservable.subscribe((updatedFriends: [String,String][]) => {
      updatedFriends.forEach((val: [String, String]) => {
        // console.log(`Received val ${val}`)
        this.RTFriendStatuses.set(val[0],val[1]);
        console.log(this.RTFriendStatuses);
      })
    })

    this.usersService.startCollectingUserStatuses();
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

    if (this.RTFriendStatusesSubscription != null) {
      this.RTFriendStatusesSubscription.unsubscribe();
      this.friendStatusesSubscription = null;
    }
     
  }

  openChatFeed(user: UserData) {
    this.messagesService.openchatFeed(user);
  }

}
