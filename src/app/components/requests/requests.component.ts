import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RequestsService } from 'src/app/services/requests.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-requests',
  templateUrl: './requests.component.html',
  styleUrls: ['./requests.component.css']
})
export class RequestsComponent implements OnInit {

  constructor(private requestsService: RequestsService, private userServer: UserService, private snackBar: MatSnackBar) { }

  ngOnInit(): void {
  }

  acceptRequest(request: any) {
    this.requestsService.acceptRequests(request)
    .then(() => {
      this.snackBar.open("Friend Added", "Okay", { duration : 3000 });
    })
    .catch((error) => {
      throw(error);
    })
  }

  deleteRequest(request: any) {
    this.requestsService.deleteRequests(request);
    this.snackBar.open("Request Ignored", "Okay", { duration: 3000 });
  }

}
