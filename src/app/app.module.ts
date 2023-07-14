import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';

/* environment */
import { environment } from 'src/environments/environment';

/* routes */
import { appRoutes } from './routes';

/* Firebase */
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getAuth, provideAuth } from '@angular/fire/auth';

/* generated components */
import { LoginPageComponent } from './components/login-page/login-page.component';
import { SignupPageComponent } from './components/signup-page/signup-page.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';

/* Material imports */
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatListModule } from '@angular/material/list';

/* services */
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { NavBarComponent } from './components/dashboard/nav-bar/nav-bar.component';
import { SidebarComponent } from './components/dashboard/sidebar/sidebar.component';
import { ProfileComponent } from './components/dashboard/sidebar/profile/profile.component';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { AddFriendsComponent } from './components/dashboard/sidebar/add-friends/add-friends.component';
import { RequestsComponent } from './components/dashboard/sidebar/requests/requests.component';
import { MyFriendsComponent } from './components/dashboard/sidebar/my-friends/my-friends.component';


@NgModule({
  declarations: [
    AppComponent,
    LoginPageComponent,
    SignupPageComponent,
    DashboardComponent,
    NavBarComponent,
    SidebarComponent,
    ProfileComponent,
    AddFriendsComponent,
    RequestsComponent,
    MyFriendsComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(appRoutes),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()),
    provideStorage(() => getStorage()),
    MatToolbarModule,
    MatIconModule,
    MatCardModule,
    DragDropModule,
    MatButtonModule,
    MatDialogModule,
    MatInputModule,
    MatExpansionModule,
    MatTooltipModule,
    MatListModule,
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [
    AuthService,
    UserService,
    MatSnackBar
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
