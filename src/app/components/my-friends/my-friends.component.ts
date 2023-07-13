import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

/* templates */
import { UserData } from 'src/app/firestore.datatypes';
import { FriendsService } from 'src/app/services/friends.service';

@Component({
  selector: 'app-my-friends',
  templateUrl: './my-friends.component.html',
  styleUrls: ['./my-friends.component.css']
})
export class MyFriendsComponent implements OnInit {

  userFriends: UserData[] = [];

  private allFriendsSubjectSubscription: Subscription | null = null;

  constructor(private friendsService: FriendsService) { }

  ngOnInit(): void {

    /* subscribe to received updated friend's list for the current user */
    this.allFriendsSubjectSubscription = this.friendsService.allFriendsObservable.subscribe((updatedFriends: UserData[]) => {
      this.userFriends = updatedFriends;
    });
  }

  ngOnDestory(): void {

    /* unsubscribe to allFriendsSubject */
    if (this.allFriendsSubjectSubscription != null)
      this.allFriendsSubjectSubscription.unsubscribe();
      this.allFriendsSubjectSubscription = null;
  }

}
