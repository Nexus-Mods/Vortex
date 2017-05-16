function init(context) {
    var app;
    context.once(() => {
        var express = require('express');
        app = express();

        var Nuts = require('nuts-serve').Nuts;
        var nuts = Nuts({
            repository: 'Nexus-Mods/Vortex-Private',
            token: '008e0c7bfa1a9a2f14df6370dfdac9340ec828a2'
        });

        app.use('/', nuts.router);

        app.listen(56000).on('error', (err) => {});
    });
}

exports.default = init;
