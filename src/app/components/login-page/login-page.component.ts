import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, Validators } from '@angular/forms';

/* to check if the email is valid */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.css']
})
export class LoginPageComponent implements OnInit {

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

  constructor(private router: Router) { }

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
    
  }

}
