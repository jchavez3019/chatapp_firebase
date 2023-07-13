import { Component, OnInit } from '@angular/core';
import { Subscribable, Subscription } from 'rxjs';
import { UserData } from 'src/app/firestore.datatypes';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {

  user: UserData = {
    displayName: "",
    lowercaseName: "",
    email: "",
    photoURL: "",
    uid: ""
  };
  nickNameEdit: boolean = false;
  newNickname: string = "";
  selectedFiles: FileList | undefined;

  /* subscriptions */
  private currentUserSubscription: Subscription | null = null;

  constructor(private userService: UserService) {
    this.currentUserSubscription = this.userService.currentUser.subscribe((user: UserData | undefined) => {
      if (user != undefined)
        this.user = user;
      else {
        this.user = {
          displayName: "",
          lowercaseName: "",
          email: "",
          photoURL: "",
          uid: ""
        }
      }
    });
   }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {

    /* remove subscriptions */
    if (this.currentUserSubscription != null) {
      this.currentUserSubscription.unsubscribe();
      this.currentUserSubscription = null;
    }
  }

  /* update the nickname of the user in firebase */
  submitNicknameButton() {
    this.userService.updateNickname(this.newNickname)
    .then(() => {
      /* disable the pop up */
      this.editNicknameButton();
    })
    .catch((error) => {
      const error_msg = error.message;
      console.log(error_msg);
    });

  }

  /* toggle the edit nickname pop up */
  editNicknameButton() {
    this.nickNameEdit = !this.nickNameEdit;
  }

  chooseImage(event: any) {
    this.selectedFiles = event.target.files;

    if((this.selectedFiles != undefined) && this.selectedFiles.item(0)) {
      this.userService.updateProfilePic(this.selectedFiles.item(0));
    }
  }

}
