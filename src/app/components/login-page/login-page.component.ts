import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FirestoreError } from '@angular/fire/firestore';
import { AuthErrorCodes } from '@angular/fire/auth';

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

  @HostListener('document:keypress', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) { 
    if (event.key === "Enter")
      this.loginButton();
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
    .then(() => {
      /* navigate to the dashboard and resolve */
      console.log("Logged in; navigating to dashboard");
      this.router.navigate(['dashboard']);
    })
    .catch((error: any) => {
      console.error("Error in loginButton with message: ");
      console.error(error);

      switch(error.code) {
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
        default:
          this.snackBar.open("Failed to login", "Close", {duration: 3000});
      }
    });
  }

}
