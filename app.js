var CONFIG    = require("./config"),
    cluster   = require('cluster'),
    fs        = require('fs'),
    sh        = require('execSync'),  // executing system commands
    Slack     = require("node-slack");
    slack     = new Slack("https://hooks.slack.com/services/" + CONFIG.SLACK_TOKEN);

if (cluster.isMaster) {
  var cpuCount        = require('os').cpus().length,
      numberOfThreads = cpuCount * CONFIG.CPU_MULTIPLIER

  for (var i = 0; i < numberOfThreads; i++) {
    cluster.fork()
  }

  cluster.on('exit', function (worker) {
    console.log('Worker ' + worker.id + ' died :(')
    cluster.fork()
  })

// Code to run if we're in a worker process
} else {
  var express   = require('express'),
      webserver = express()

  webserver.use (function (req, res) {
    var buffered_out = "<style>pre { background: black;color: white;padding: 20px; } tr:hover { color: white; background: black; } tr:hover a { color: white; } td {padding: 0 20}</style>",
        url_folders  = req.originalUrl.split ('/'),
        env          = url_folders[1],
        action       = url_folders[2],
        playbook     = url_folders[3]

    if (action == "build") {
      buffered_out += build (playbook, env)
    } else if (action == "reforge") {
      buffered_out += reforge (playbook, env)
    } else if (action == "hotswap") {
      buffered_out += hotswap (playbook, env)
    } else {
      buffered_out += showIndex ()
    }

    res.send(buffered_out)
  })

  webserver.listen(CONFIG.PORT, 'localhost')
}

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
      console.log ("Slack: " + error.message)
    }
  })
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
  var cmd          = "cd " + CONFIG.REPOSITORY_HOME + " && " +
                     "s3cmd sync playbook-" + playbook + "/ s3://telusdigital-forge/" + playbook + "/",
      enviroments  = sh.exec ("cat " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + "/hosts/" + env + " | grep teluswebteam.com").stdout.split(/\r\n|\r|\n/g),
      buffered_out = ""

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

function hotswap (playbook, env) {
  var cmd          = "cd " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + " && " +
                     "ansible-playbook infrastructure.yml -i hosts/" + env + " --skip-tags dns",
      buffered_out = ""

  buffered_out += "<h1>Hotswapping " + playbook + " in " + env + "</h1><h2>" + cmd + "</h2>"

  buffered_out += "<pre>" + sh.exec (cmd).stdout + "</pre>"

//  sendSlack (playbook + " infra completed in " + env)

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
                      "  <td><a href='/next/build/" + this_playbook + "'>build infra</a> / <a href='/next/reforge/" + this_playbook + "'>reforge</a> / <a href='/next/hotswap/" + this_playbook + "'>hotswap</a></td>" +
                      "  <td><a href='/development/" + this_playbook + "'>build infra</a> / <a href='/development/reforge/" + this_playbook + "'>reforge</a> / <a href='/development/hotswap/" + this_playbook + "'>hotswap</a></td>" +
                      "  <td><a href='/staging/build/" + this_playbook + "'>build infra</a> / <a href='/staging/reforge/" + this_playbook + "'>reforge</a> / <a href='/staging/hotswap/" + this_playbook + "'>hotswap</a></td>" +
                      "  <td><a href='/production/build/" + this_playbook + "'>build infra</a> / <a href='/production/reforge/" + this_playbook + "'>reforge</a> / <a href='/production/hotswap/" + this_playbook + "'>hotswap</a></td>" +
                      "</tr>"
    }
  }

  buffered_out += "</table>"

  return buffered_out
}
