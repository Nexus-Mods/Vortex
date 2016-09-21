var express = require('express');
var Nuts = require('nuts-serve').Nuts;

function init(context) {
    var app;
    context.once(() => {
        app = express();

        var nuts = Nuts({
            repository: "Nexus-Mods/NMM2",
            token: "008e0c7bfa1a9a2f14df6370dfdac9340ec828a2"
        });

        app.use('/', nuts.router);

        app.listen(56000).on('error', (err) => { });
    });
}

exports.default = init;
