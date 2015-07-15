var CONFIG    = require("./config"),
    express   = require('express'),
    fs        = require('fs'),
    ini       = require('node-ini'),
    webserver = express(),
    sh        = require('execSync')  // executing system commands

// taken from http://stackoverflow.com/questions/1144783/replacing-all-occurrences-of-a-string-in-javascript on 20150812 @ 05:00 EST
function replaceAll(find, replace, str) {
  return str.replace(new RegExp(find, 'g'), replace);
}

function getFiles (dir, files_){
    files_    = files_ || []
    var files = fs.readdirSync(dir)

    for (var i in files) {
        var name = dir + '/' + files[i]

        files_.push(name)
    }

    return files_
}

webserver.use (function (req, res) {
  var buffered_out = "",
      files        = getFiles(CONFIG.REPOSITORY_HOME),
      url_folders  = req.originalUrl.split ('/'),
      action       = url_folders[1],
      env          = url_folders[2],
      playbook     = url_folders[3]

  if (action == "build") {
  	var cmd = "cd " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + " && " +
  	          "ansible-playbook infrastructure.yml -i hosts/" + env

    buffered_out += "building " + playbook + " in " + env + "<br>" + cmd + "<br>"
    buffered_out += "<pre style='background: black;color: white;padding: 20px;'>" + sh.exec (cmd).stdout + "</pre>"

  } else if (action == "reforge") {
  	var cmd = "cd " + CONFIG.REPOSITORY_HOME + " && " +
  	          "s3cmd sync playbook-" + playbook + "/ s3://telusdigital-forge/" + playbook + "/"
  	var enviroments = sh.exec ("cat " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + "/hosts/" + env + " | grep teluswebteam.com").stdout.split(/\r\n|\r|\n/g)
  	buffered_out += "Reforge " + playbook + " in " + env + "<br>" + cmd + "<br>"

  	for (var i in enviroments)
  		if (enviroments[i] != "")
    buffered_out += "<pre style='background: black;color: white;padding: 20px;'>" + enviroments[i] + "</pre>"
  } else {
	  buffered_out += "<table><tr>"
	  buffered_out += "<th>Playbook</th>"
	  buffered_out += "<th>Next</th>"
	  buffered_out += "<th>Development</th>"
	  buffered_out += "</tr>"

	  for (var i in files) {
	  	var file = files[i].replace (CONFIG.REPOSITORY_HOME + "/", "")

	  	if (file.indexOf ("playbook-") == 0) {
	  	  var this_playbook = file.replace ("playbook-", "")

	      buffered_out += "<tr>"
	      buffered_out += "<td>" + this_playbook + "</td>"
	      buffered_out += "<td><a href='/build/next/" + this_playbook + "'>build infra</a> / "
	      buffered_out += "<a href='/reforge/next/" + this_playbook + "'>reforge</a></td>"
	      buffered_out += "<td><a href='/build/development/" + this_playbook + "'>build infra</a></td>"
	      buffered_out += "</tr>"
	    }
	  }

	  buffered_out += "</table>"
  }

  res.send(buffered_out)
})

webserver.listen(CONFIG.PORT, 'localhost')