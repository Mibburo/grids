const express = require('express');
const app = express();
const mongoose = require('mongoose');

app.set("view engine", "ejs");

const expressSession = require('express-session');

const session = {
    secret: "someSecret",
    cookie: {},
    resave: false,
    saveUninitialized: false
  };

app.use(expressSession(session));

const indexController = require('./index');
app.use('/', indexController);

const { getConfiguredPassport, passportController } = require('./passport');
const userController = require("./user");
const jwksController = require("./jwks");

(async () => {
    const passport = await getConfiguredPassport();
    app.use(passport.initialize());
    app.use(passport.session());
    app.use('/', passportController);
    
    const userController = require('./user');
    app.use('/user', userController);

    const jwksController = require('./jwks');
    app.use('/jwks', jwksController);
    
    app.listen(3000, () => {
        console.log('Server started and listening on port 3000');
    });
})();

// mongo DB url
const mongoDbUrl = "mongodb://localhost:27017/grids";

//connect to the database
mongoose.connect(mongoDbUrl,
    {
        useNewUrlParser: true
    }
);
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log('Connected to the database');
});
