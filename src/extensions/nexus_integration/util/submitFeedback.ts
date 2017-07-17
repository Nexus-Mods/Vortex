import * as fs from 'fs-extra-promise';
import request = require('request');

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

export function submitFeedback(
  APIKEY: string,
  userId: number,
  feedbackFiles: string[]): Promise<any> {
  return new Promise<any>((resolve, reject) => {

    request.post({
      headers: { 'content-type': 'application/json', APIKEY: { APIKEY } },
      url: 'https://api.nexusmods.com/v1/users/' + userId + '/feedbacks/',
    }, (error, response, body) => {
      console.log(body);
    });

    /*  const req = request.post('https://api.nexusmods.com/v1/users/' + userId + '/feedbacks',
       (err, httpResponse, body) => {
         if (err === null) {
           resolve(httpResponse);
         }
       });
     const form = req.form();
     feedbackFiles.forEach(file => {
       form.append('file', fs.createReadStream(file));
     });
     req.on('requestTimeout', () => reject(new TimeoutError('contacting api')));
     req.on('responesTimeout', () => reject(new TimeoutError('contacting api')));
     req.on('error', (err) => reject(err)); */
  });
}
