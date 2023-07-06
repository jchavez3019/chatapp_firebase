import { Component, OnInit } from '@angular/core';

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

  constructor(private friendsService: FriendsService) { }

  ngOnInit(): void {

    /* subscribe to received updated friend's list for the current user */
    this.friendsService.allFriendsSubject.subscribe((updatedFriends: UserData[]) => {
      this.userFriends = updatedFriends;
    });
  }

}
