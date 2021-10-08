const express = require('express');
const router = express.Router();

const handleUserProfile = (req, res) => {
    res.render('user', {
        username: req.user.profile.sub,
        client: req.user.profile.audience
    });
    console.log("req  : " + req.toString());
    console.log("res  : " + res.toString());
}

router.get('/', handleUserProfile);

module.exports = router; 