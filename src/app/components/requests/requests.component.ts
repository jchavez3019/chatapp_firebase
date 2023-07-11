import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RequestsService } from 'src/app/services/requests.service';
import { UserService } from 'src/app/services/user.service';
import { QuerySnapshot, FirestoreError } from '@angular/fire/firestore';

import { UserData } from 'src/app/firestore.datatypes';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-requests',
  templateUrl: './requests.component.html',
  styleUrls: ['./requests.component.css']
})
export class RequestsComponent implements OnInit, OnDestroy {

  /* unsubscribes to snapshot that listens for friend requests */
  private unsubMyRequests: any;

  /* all the friend requests for the current user */
  // requests: req = {requests: []};

  receivedRequests: UserData[] = [];

  private receivedRequestsSubjectSubscription: Subscription | null = null;

  constructor(private requestsService: RequestsService, private userServer: UserService, private snackBar: MatSnackBar) { }

  ngOnInit(): void {

    /* subscribe to the user's that have sent the current user a friend request */
    this.receivedRequestsSubjectSubscription = this.requestsService.receivedRequestsSubject.subscribe((updatedReceivedRequests: UserData[]) => {
      this.receivedRequests = updatedReceivedRequests;
    });

  }

  ngOnDestroy(): void {
    /* unsubscribe to requests snapshot */
    this.unsubMyRequests();

    /* unsubscribe to receivedRequestsSubject */
    if (this.receivedRequestsSubjectSubscription != null) {
      this.receivedRequestsSubjectSubscription.unsubscribe();
    }
  }

  /* accepts a friend request */
  acceptRequest(request: any) {
    this.requestsService.acceptRequests(request)
    .then(() => {
      this.snackBar.open("Friend Added", "Okay", { duration : 3000 });
    })
    .catch((error) => {
      throw(error);
    })
  }

  /* ignores a friend request */
  deleteRequest(request: any) {
    this.requestsService.deleteRequests(request);
    this.snackBar.open("Request Ignored", "Okay", { duration: 3000 });
  }

}

/* allows pass by reference */
export interface req {
  requests: UserData[]
}
