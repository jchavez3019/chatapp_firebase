import { Component, OnInit } from '@angular/core';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {

  user: any;
  nickNameEdit: boolean = false;
  newNickname: string = "";


  constructor(private userService: UserService) {
    this.userService.currentUser.subscribe((user) => {
      this.user = user;
    });
   }

  ngOnInit(): void {
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

  }

}
