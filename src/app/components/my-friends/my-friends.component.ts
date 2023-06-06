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

    /* get all the friends */
    this.getAllFriends();
  }

  /* gets all the current user's friends from firebase */
  getAllFriends() {

    this.friendsService.getMyFriends()
    .then((retFriends: UserData[]) => {
      this.userFriends = retFriends;
    })
    .catch((error) => {
      console.log("Error getting friends from component with head: " + error.name + " with message: " + error.message);
    });

  }

}
