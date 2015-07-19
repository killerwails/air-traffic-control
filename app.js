var CONFIG    = require("./config"),
    express   = require('express'),
    fs        = require('fs'),
    webserver = express(),
    sh        = require('execSync'),  // executing system commands
    Slack     = require("node-slack");
    slack     = new Slack("https://hooks.slack.com/services/" + CONFIG.SLACK_TOKEN);

webserver.use (function (req, res) {
  var buffered_out = "<style>pre { background: black;color: white;padding: 20px; } tr:hover { color: white; background: black; } tr:hover a { color: white; }</style>",
      url_folders  = req.originalUrl.split ('/'),
      action       = url_folders[1],
      env          = url_folders[2],
      playbook     = url_folders[3]

  if (action == "build") {
    buffered_out += build (playbook, env)
  } else if (action == "reforge") {
    buffered_out += reforge (playbook, env)
  } else {
    buffered_out += showIndex ()
  }

  res.send(buffered_out)
})

webserver.listen(CONFIG.PORT, 'localhost')

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

function sendSlack (message) {
  slack.send({
    text: message,
    channel: "#skynet",
    username: "ATC"
  }, function (error) {
    if (error != null && error.message != null) {
      console.log ("Slack: " + error.message);
    }
  });
}

function build (playbook, env) {
  var cmd          = "cd " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + " && " +
                     "ansible-playbook infrastructure.yml -i hosts/" + env,
      buffered_out = ""

  buffered_out += "<h1>Building " + playbook + " in " + env + "</h1><h2>" + cmd + "</h2>"

  buffered_out += "<pre>" + sh.exec (cmd).stdout + "</pre>"

  sendSlack (playbook + " infra completed in " + env)

  return buffered_out
}

function reforge (playbook, env) {
  var cmd         = "cd " + CONFIG.REPOSITORY_HOME + " && " +
                    "s3cmd sync playbook-" + playbook + "/ s3://telusdigital-forge/" + playbook + "/",
      enviroments = sh.exec ("cat " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + "/hosts/" + env + " | grep teluswebteam.com").stdout.split(/\r\n|\r|\n/g)

  buffered_out += "<h1>Reforge " + playbook + " in " + env + "</h1><h2>" + cmd + "</h2>"

  buffered_out += "<pre>" + sh.exec (cmd).stdout + "</pre>"

  for (var i in enviroments) {
    if (enviroments[i] != "") {
      buffered_out += "<h2>" + enviroments[i] + "</h2>"
      buffered_out += "<pre>" + sh.exec ("echo 'sudo reforge' | ssh -o StrictHostKeyChecking=no " + CONFIG.USERID + "@" + enviroments[i]).stdout + "</pre>"
    }
  }

  return buffered_out
}

function showIndex () {
  var files        = getFiles(CONFIG.REPOSITORY_HOME),
      buffered_out = "<table>" +
                     "  <tr>" +
                     "    <th>Playbook</th>" +
                     "    <th>Next</th>" +
                     "    <th>Development</th>" +
                     "    <th>Staging</th>" +
                     "    <th>Production</th>" +
                     "  </tr>"

  for (var i in files) {
    var file = files[i].replace (CONFIG.REPOSITORY_HOME + "/", "")

    if (file.indexOf ("playbook-") == 0) {
      var this_playbook = file.replace ("playbook-", "")

      buffered_out += "<tr>" +
                      "  <td>" + this_playbook + "</td>" +
                      "  <td><a href='/build/next/" + this_playbook + "'>build infra</a> / <a href='/reforge/next/" + this_playbook + "'>reforge</a></td>" +
                      "  <td><a href='/build/development/" + this_playbook + "'>build infra</a> / <a href='/reforge/development/" + this_playbook + "'>reforge</a></td>" +
                      "  <td><a href='/build/staging/" + this_playbook + "'>build infra</a> / <a href='/reforge/staging/" + this_playbook + "'>reforge</a></td>" +
                      "  <td><a href='/build/production/" + this_playbook + "'>build infra</a> / <a href='/reforge/production/" + this_playbook + "'>reforge</a></td>" +
                      "</tr>"
    }
  }

  buffered_out += "</table>"

  return buffered_out
}
