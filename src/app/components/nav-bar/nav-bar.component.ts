import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-nav-bar',
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.css']
})
export class NavBarComponent implements OnInit {

  constructor(private router: Router, private auth: AuthService) { }

  ngOnInit(): void {
  }

  logoutButton() {
    this.auth.logout()
    .then(()=> {
      /* once the service takes care of ending background tasks, can navigate back to login*/
      this.router.navigate(['login']);
    })
    .catch((error) => {
      console.log("Error logging out with message: \n" + error.message);
    });
  }

}
