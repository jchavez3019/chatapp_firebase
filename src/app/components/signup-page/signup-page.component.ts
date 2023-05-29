import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { FormControl, Validators } from '@angular/forms';

/* to check if the email is valid */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

@Component({
  selector: 'app-signup-page',
  templateUrl: './signup-page.component.html',
  styleUrls: ['./signup-page.component.css']
})
export class SignupPageComponent implements OnInit {

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

  constructor(private auth: AuthService) { }

  ngOnInit(): void {
  }

  /*
    Uses firestore auth to create a new user
  */
  createAccountButton() {
    this.auth.signUp(this.usercreds);
  }

}
