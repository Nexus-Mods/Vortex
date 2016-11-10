import bodyParser = require('body-parser');

import ModDB from './moddb';
import {ILookupResult} from './types';

/**
 * serve the specified database through a rest
 *
 * @param {ModDB} db
 */
export function serveREST(db: ModDB, portIn?: number) {
  const express = require('express');
  let app = express();
  let router = express.Router();
  let port = portIn || 51666;

  router.route('/byKey/:file_hash')
      .get((req, res) => {
        db.getByKey(req.params.file_hash)
            .then((mods: ILookupResult[]) => res.json(mods))
            .catch((err) => res.send(err));
      });

  router.route('/describe')
      .post((req, res) => {
        db.insert(req.body)
            .then(() => { res.json({result: 'OK'}); })
            .catch((err) => res.send(err));
      });

  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json());
  app.use('/api', router);

  app.listen(port, () => { console.log(`Serving database on ${port}!`); });
}
