import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

/* to check if the email is valid */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.css']
})
export class LoginPageComponent implements OnInit {

  wrong_password = false;
  user_not_found = false;

  /* user information */
  usercreds = {
    email: '',
    password: '',
    displayName: ''
  };

  /* form control */
  emailFormControl: FormControl = new FormControl('', [
    Validators.required,
    Validators.pattern(EMAIL_REGEX)
  ]);
  passwordFormControl: FormControl = new FormControl('', [
    Validators.required
  ])

  constructor(private router: Router, private auth: AuthService, private snackBar: MatSnackBar) { }

  ngOnInit(): void {
  }

  /*
    Takes the user to the sign up page
  */
  signupButton() {
    this.router.navigate(['signup']);
  }

  /* 
    Logs the user into firebase
  */
  loginButton() {
    this.auth.login(this.usercreds)
    .catch((error) => {
      const error_msg = error.message;
      console.log("Error in loginButton with message: " + error_msg);

      // if (error_msg == "auth/wrong-password") {
      //   this.wrong_password = true;
      // }
      switch(error_msg) {
        case "auth/wrong-password":
          this.wrong_password = true;
          this.user_not_found = false;
          this.snackBar.open("Invalid Email/Password", "Close", {duration: 3000});
          break;
        case "auth/user-not-found":
          this.wrong_password = false;
          this.user_not_found = true;
          this.snackBar.open("User not found", "Close", {duration: 3000});
          break;
      }
    });
  }

}
