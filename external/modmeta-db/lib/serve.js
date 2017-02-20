"use strict";
const bodyParser = require("body-parser");
function serveREST(db, portIn) {
    const express = require('express');
    let app = express();
    let router = express.Router();
    let port = portIn || 51666;
    router.route('/byKey/:file_hash')
        .get((req, res) => {
        db.getByKey(req.params.file_hash)
            .then((mods) => res.json(mods))
            .catch((err) => res.send(err));
    });
    router.route('/describe')
        .post((req, res) => {
        db.insert(req.body)
            .then(() => { res.json({ result: 'OK' }); })
            .catch((err) => res.send(err));
    });
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.use('/api', router);
    app.listen(port, () => { console.log(`Serving database on ${port}!`); });
}
exports.serveREST = serveREST;
