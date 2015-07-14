var CONFIG    = require("./config"),
    express   = require('express'),
    webserver = express()

webserver.use (function (req, res) {
	res.send("hello world")
})


webserver.listen(3000, 'localhost')