var CONFIG    = require("./config"),
    express   = require('express'),
    fs        = require('fs'),
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

    buffered_out += "<h1>Building " + playbook + " in " + env + "</h1><h2>" + cmd + "</h2>"
    buffered_out += "<pre style='background: black;color: white;padding: 20px;'>" + sh.exec (cmd).stdout + "</pre>"

  } else if (action == "reforge") {
  	var cmd = "cd " + CONFIG.REPOSITORY_HOME + " && " +
  	          "s3cmd sync playbook-" + playbook + "/ s3://telusdigital-forge/" + playbook + "/"
  	var enviroments = sh.exec ("cat " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + "/hosts/" + env + " | grep teluswebteam.com").stdout.split(/\r\n|\r|\n/g)
  	buffered_out += "<h1>Reforge " + playbook + " in " + env + "</h1><h2>" + cmd + "</h2>"

  	buffered_out += "<pre style='background: black;color: white;padding: 20px;'>" + sh.exec (cmd).stdout + "</pre>"

  	for (var i in enviroments) {
      if (enviroments[i] != "") {
      	buffered_out += "<h2>" + enviroments[i] + "</h2>"
        buffered_out += "<pre style='background: black;color: white;padding: 20px;'>" + sh.exec ("echo 'sudo reforge' | ssh -o StrictHostKeyChecking=no " + CONFIG.USERID + "@" + enviroments[i]).stdout + "</pre>"
      }
    }
  } else {
	  buffered_out += "<table><tr>"
	  buffered_out += "<th>Playbook</th>"
	  buffered_out += "<th>Next</th>"
    buffered_out += "<th>Development</th>"
    buffered_out += "<th>Staging</th>"
	  buffered_out += "<th>Production</th>"
	  buffered_out += "</tr>"

	  for (var i in files) {
	  	var file = files[i].replace (CONFIG.REPOSITORY_HOME + "/", "")

	  	if (file.indexOf ("playbook-") == 0) {
	  	  var this_playbook = file.replace ("playbook-", "")

	      buffered_out += "<tr>"
	      buffered_out += "<td>" + this_playbook + "</td>"
	      buffered_out += "<td><a href='/build/next/" + this_playbook + "'>build infra</a> / "
	      buffered_out += "<a href='/reforge/next/" + this_playbook + "'>reforge</a></td>"
        buffered_out += "<td><a href='/build/development/" + this_playbook + "'>build infra</a> / "
        buffered_out += "<a href='/reforge/development/" + this_playbook + "'>reforge</a></td>"
        buffered_out += "<td><a href='/build/staging/" + this_playbook + "'>build infra</a> / "
        buffered_out += "<a href='/reforge/staging/" + this_playbook + "'>reforge</a></td>"
        buffered_out += "<td><a href='/build/production/" + this_playbook + "'>build infra</a> / "
        buffered_out += "<a href='/reforge/production/" + this_playbook + "'>reforge</a></td>"
	      buffered_out += "</tr>"
	    }
	  }

	  buffered_out += "</table>"
  }

  res.send(buffered_out)
})

webserver.listen(CONFIG.PORT, 'localhost')