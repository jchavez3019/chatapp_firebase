import { Routes } from '@angular/router';

/* generated components */
import { LoginPageComponent } from './components/login-page/login-page.component';
import { SignupPageComponent } from './components/signup-page/signup-page.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { AuthGuard } from './services/auth.guard';

/* 
    The 3rd entry is a wildcard where any url that 
    doesn't match other entries just redirects to the login page 
*/
export const appRoutes: Routes = [
    { path: 'login', component: LoginPageComponent },
    { path: 'signup', component: SignupPageComponent },
    { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard]},
    { path: '', redirectTo: '/login', pathMatch: 'full' }
];