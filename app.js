// Code related to express session and passport need to be in the same order as written here

require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption"); 
// const md5=require("md5");
// const bcrypt=require("bcrypt");
// const saltRounds=8;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
const findOrCreate = require('mongoose-findorcreate')
const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: "This is a secret string.",
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", { useNewUrlParser: true });

// Old Schema
// const userSchema = {
//     email: String,
//     password: String
// };


//New Schema
const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String,
    secret: [{
        type:String
    }]
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
    done(null, user.id);
});  
passport.deserializeUser(function(id, done) {
    User.findById(id,function(err,user){
        done(err,user);
  })
});

passport.use(new GoogleStrategy({
    clientID:     process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    passReqToCallback   : true
  },
  function(request, accessToken, refreshToken, profile, done) {
    User.findOrCreate({email: profile.emails[0].value, googleId:profile.id }, function (err, user) {
        console.log(profile.id);
        return done(err, user);
    });
  }
));


////////////// Routing ////////////

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/login", function (req, res) {
    res.render("login");
});

app.post("/login",function(req,res){
    const loginUser = new User({
        username:req.body.username,
        password:req.body.password
    });
    req.login(loginUser,function(err){
        if(err){ console.log(err); res.redirect("/login"); }
        else{
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets"); 
            });
        }
    });
})

app.get("/register", function (req, res) {
    res.render("register");
});

app.get("/secrets",function(req,res){
    User.find({"secret":{$ne:null}}, function(err,foundUsers){
        if(err){ console.log(err); }
        else{
            if(foundUsers){
                
                res.render("secrets", { usersWithSecrets:foundUsers });
            }
        }
    })
    // if(req.isAuthenticated()){ res.render("secrets"); }
    // else{ res.redirect("/login"); }
});

app.get("/submit", function (req, res) {
    if(req.isAuthenticated()){ res.render("submit"); }
    else{ res.redirect("/login"); }
});

app.post("/submit",function(req,res){
    const submittedSecret = req.body.secret;
    console.log(submittedSecret);
    console.log(req.user.id);
    User.findByIdAndUpdate(req.user.id,
        {
            $push:{
                secret:submittedSecret
            }
        },
        {new : true},
        function(err,user){
            if(err){ console.log(err); }
            else{ console.log(user); }
            res.redirect("/secrets");
        }
    );
});

app.post("/register", function (req, res) {
    const newEmail = req.body.username;
    const newPassword = req.body.password;
    User.register({username:newEmail},newPassword,function(err,user){
        if(err){ console.log(err); res.redirect("/register"); }
        else{ 
            passport.authenticate("local")(req,res,function(){
                res.redirect("/secrets"); 
            });
        }
    });
});

app.get('/auth/google',
    passport.authenticate('google', { scope: ['email','profile'] }
));
    
app.get('/auth/google/secrets',
    passport.authenticate('google',{failureRedirect:"/login"}),
    function(req,res){    
        res.redirect("/secrets");
    }
);

app.get("/logout",function(req,res){
    req.logout();
    res.redirect("/");
})

app.listen(3000, function () {
    console.log("We're up!");
});



// Code used earlier (Encryption using mongoose-encryption)

// We'll add a plugin next. Plugins are packaged code that can be added to mongoose schema to increase he functionality

// userSchema.plugin(encrypt, { secret:process.env.SECRETSTRING, encryptedFields:["password"] });
// To encrypt more than a single field, put them inside the encryptedFields array

// process.env.<Name> is how you access the data from .env file
// console.log(process.env.API_KEY);


// Logging in through md5
// app.post("/login",function(req,res){
//     const enteredName = req.body.username;
//     const enteredPassword = md5(req.body.password);
//     User.findOne({email:enteredName},function(err,foundUser){
//         if(err){ console.log(err); }
//         else{
//             if(foundUser){
//                 console.log('Someone is trying to login to '+enteredName);
//                 if(foundUser.password===enteredPassword){ res.render("secrets"); }
//             }
//         }
//     })
// })

// Logging in through brcypt
// app.post("/login",function(req,res){
//     const enteredName = req.body.username;
//     const enteredPassword = req.body.password;
//     User.findOne({email:enteredName},function(err,foundUser){
//         if(err){ console.log(err); }
//         else{
//             if(foundUser){
//                 console.log('Someone is trying to login to '+enteredName);
//                 bcrypt.compare(enteredPassword, foundUser.password, function(err, result) {
//                     if(result===true){ res.render("secrets"); }
//                 });
//             }
//         }
//     });
// })


// Registering through md5
// app.post("/register", function (req, res) {
//     const newEmail = req.body.username;
//     const newPassword = req.body.password;
//     const newUser = new User({
//         email: newEmail,
//         password: md5(newPassword)
//     });
//     newUser.save(function (err) {
//         if (err) { console.log(err); }
//         else { console.log(newUser); res.render("secrets"); }
//     });
// });

// Registering through bcrypt
// app.post("/register", function (req, res) {
//     const newEmail = req.body.username;
//     const newPassword = req.body.password;
    
//     // New Password is generated by the following function and 'hash' is the pswrd
//     bcrypt.hash(newPassword, saltRounds, function(err, hash) {
//         const newUser = new User({
//             email: newEmail,
//             password: hash
//         });
//         newUser.save(function (err) {
//             if (err) { console.log(err); }
//             else { console.log(newUser); res.render("secrets"); }
//         });
//     });
// });