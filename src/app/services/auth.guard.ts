import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable, Subscription, filter, take } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private authService: AuthService, private router: Router) {}
  
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

      /* lastLoginStatus has not had the chance to get a login status from the observable,
      just subscribe ourselves and wait for the first value */
      return new Promise<boolean>((resolve, reject) => {

        // console.log("waiting to check if user can navigate")
        this.authService.hasAuthSignedInObservable
        .pipe(
          filter((loginStatus: boolean | null) => {
            if (loginStatus != null)
              return true;
            else
              return false;
          }),
          take(1)
        )
        .subscribe(
          (loggedIn: boolean | null) => {

            if (loggedIn == null) {
              console.error("In auth guard, loggedIn passed as null");
              reject();
            }

            if (loggedIn) {
              resolve(true);
            }
            else {
              this.router.navigate(['login']);
              resolve(false);
            }
          }
        )        
      });

      
  }
  
}
