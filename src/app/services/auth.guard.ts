import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {


  constructor(private authService: AuthService, private router: Router) { }
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

      const isUserLoggedIn: Boolean = this.authService.authUserLoggedIn();

      // console.log("Auth guard found user logged in as: " + isUserLoggedIn);

      if (this.authService.authUserLoggedIn()) {
        return true;
      }
      else {
        // console.log("You must be logged in");
        this.router.navigate(['login']);
        return false;
      }
  }
  
}
