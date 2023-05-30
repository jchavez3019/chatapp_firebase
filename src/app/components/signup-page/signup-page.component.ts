import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { FormControl, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

/* to check if the email is valid */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

@Component({
  selector: 'app-signup-page',
  templateUrl: './signup-page.component.html',
  styleUrls: ['./signup-page.component.css']
})
export class SignupPageComponent implements OnInit {

  user_exists: boolean = false;

  /* user information */
  usercreds = {
    email: '',
    password: '',
    displayName: ''
  };

  /* form controls */
  emailFormControl: FormControl = new FormControl('', [
    Validators.required,
    Validators.pattern(EMAIL_REGEX)
  ]);
  passwordFormControl: FormControl = new FormControl('', [
    Validators.required
  ])

  constructor(private auth: AuthService, private snackBar: MatSnackBar) { }

  ngOnInit(): void {
  }

  /*
    Uses firestore auth to create a new user. 
    Async because auth.signUp (also async) must communicate with Firestore
  */
  createAccountButton() {
    /* await result from firestore */
    this.auth.signUp(this.usercreds)
    .catch((error) => {
      const error_msg = error.message;
      console.log("Error in createAccountButton with message: " + error_msg);
      
      /* email already in use */
      if (error_msg == 'auth/email-already-in-use') {
        this.user_exists = true;
        this.snackBar.open("Email already in use", "Close", { duration: 3000 });
      }
    });
  }

}
