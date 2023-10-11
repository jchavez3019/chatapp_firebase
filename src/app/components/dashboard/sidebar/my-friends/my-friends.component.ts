import { Component, OnInit } from '@angular/core';
import { Unsubscribe } from '@angular/fire/firestore';
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
  RTFriendStatuses:  Map<String, String> = new Map<String, String>();

  private allFriendsSubjectSubscription: Subscription | null = null;
  private RTFriendStatusUnsubscriptions: Unsubscribe[] = [];

  constructor(private friendsService: FriendsService, 
    private usersService: UserService,
    private messagesService: MessagesService) {}

  ngOnInit(): void {

    /* subscribe to received updated friend's list for the current user */
    this.allFriendsSubjectSubscription = this.friendsService.allFriendsObservable.subscribe((updatedFriends: UserData[]) => {
      this.userFriends = updatedFriends;

      /* check if their are any friends whose status you do not have and get listen for their status changes */
      let newFriends: UserData[] = [];
      this.userFriends.forEach((user: UserData) => {
        if (user != undefined && !this.RTFriendStatuses.has(user.email)) {
          newFriends.push(user);
        }
      })

      /* if we have found new friends, get a subscription to their statuses and perform initial query */
      if (newFriends.length > 0) {
        /* subscription for modifications to status */
        this.RTFriendStatusUnsubscriptions.push(...this.usersService.getSnapshotFriendStatuses(newFriends, this._RTFriendUpdateCallback, this));

        /* getting initial status */
        this.usersService.getInitialFriendStatuses(newFriends, this._RTFriendInitCallback, this);
      }
      
    });

  }

  ngOnDestory(): void {

    /* unsubscribe to allFriendsSubject */
    if (this.allFriendsSubjectSubscription != null) {
      this.allFriendsSubjectSubscription.unsubscribe();
      this.allFriendsSubjectSubscription = null;
    }

    /* unsubscribe to all status snapshots */
    this.RTFriendStatusUnsubscriptions.forEach((unsub: Unsubscribe) => {
      unsub();
    })
     
  }

  openChatFeed(user: UserData) {
    this.messagesService.openchatFeed(user);
  }

  /* Callback function to be used by usersService to place Statuses into Map */
  private _RTFriendUpdateCallback(email: String, status: String, ctx: any) : void {
    ctx.RTFriendStatuses.set(email, status);
  }

  /* Callback function to be used by usersService to place Statuses into Map */
  private _RTFriendInitCallback(email: String, status: String, ctx: any) : void {
    if (!ctx.RTFriendStatuses.has(email)) {
      ctx.RTFriendStatuses.set(email, status);
    }
  }

}
