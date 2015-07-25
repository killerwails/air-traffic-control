var CONFIG                    = require("./config"),
    cluster                   = require('cluster'),
    AWS                       = require("aws-sdk"),
    ENVIROMENT_AWS_REGION_MAP = require("./enviromentAwsRegionMap.json"),
    fs                        = require('fs'),
    sh                        = require('execSync'),  // executing system commands
    Slack                     = require("node-slack");
    slack                     = new Slack("https://hooks.slack.com/services/" + CONFIG.SLACK_TOKEN);

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
        playbook     = url_folders[3],
        role         = url_folders[4]

    if (env == "") {
      buffered_out += showEnviromentSelection ()
    } else if (action == "build") {
      buffered_out += build (playbook, env)
    } else if (action == "reforge") {
      buffered_out += reforge (playbook, env)
    } else if (action == "hotswap") {
      buffered_out += hotswap (playbook, env, role)
    } else {
      buffered_out += showIndex (env)
    }

    res.send(buffered_out)
  })

  webserver.listen(CONFIG.PORT, 'localhost')
  console.log('Air Traffic Control is running')
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

function hotswap (playbook, env, role) {
  var cmd          = "cd " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + " && " +
                     "ansible-playbook infrastructure.yml -i hosts/" + env + " --skip-tags dns",
      enviroments  = sh.exec ("cat " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + "/hosts/" + env + " | grep teluswebteam.com").stdout.split(/\r\n|\r|\n/g),
      enviroment   = "",
      buffered_out = "",
      params = {
        DryRun: false,
        Filters: [{
            Name: 'instance.group-name',
            Values: [playbook + "-" + role]
          }]
      }

  for (var i in enviroments) {
    if (enviroments[i].indexOf (role) >= 0) {
      enviroment = enviroments[i]
    }
  }

  AWS.config.region = ENVIROMENT_AWS_REGION_MAP[env]

  new AWS.EC2().describeInstances(params, function(error, data) {
    if (error) {
      console.log(error)
    } else {
      var instanceId = data.Reservations[0].Instances[0].InstanceId

      for (t in data.Reservations[0].Instances[0].Tags) {
        var key   = data.Reservations[0].Instances[0].Tags[t].Key,
            value = data.Reservations[0].Instances[0].Tags[t].Value

        if (key == "Role") {
          value += "-broken"

          params = {
            Resources: [instanceId],
            Tags: [{
              Key: key,
              Value: value
            }]
          }
          new AWS.EC2().createTags(params, function(err) {
            console.log("Tagging instance", err ? "failure" : "success");
          })
        }
      }
    }
  })

  buffered_out += "<h1>Hotswapping " + playbook + " in " + env + "</h1><h2>" + cmd + "</h2>"

  buffered_out += "<pre>" + sh.exec (cmd).stdout + "</pre>"

//  sendSlack (playbook + " infra completed in " + env)

  return buffered_out
}

function showEnviromentSelection () {
  var buffered_out = "<h1>Select enviroment</h1>" +
                     "  <ul>" +
                     "    <li><a href='next/'>next</a></li>" +
                     "    <li><a href='development/'>development</a></li>" +
                     "    <li><a href='staging/'>staging</a></li>" +
                     "    <li><a href='production/'>production</a></li>" +
                     "  </ul>"

  return buffered_out
}

function showIndex (enviroment) {
  var files        = getFiles(CONFIG.REPOSITORY_HOME),
      buffered_out = "<h1><a href='../'>&lt;</a>" + enviroment + "</h1>" +
                     "<table>" +
                     "  <tr>" +
                     "    <th>Playbook</th>" +
                     "    <th></th>" +
                     "  </tr>"

  for (var i in files) {
    var file = files[i].replace (CONFIG.REPOSITORY_HOME + "/", "")

    if (file.indexOf ("playbook-") == 0) {
      var this_playbook = file.replace ("playbook-", "")

      buffered_out += "<tr>" +
                      "  <td>" + this_playbook + "</td>" +
                      "  <td>" + 
                      "    <a href='/" + enviroment + "/build/" + this_playbook + "'>build infra</a> | " +
                      "    <a href='/" + enviroment + "/reforge/" + this_playbook + "'>reforge</a> | " + 
                      "    hotswap: <a href='/" + enviroment + "/hotswap/" + this_playbook + "/inbound'>Inbound</a>" +
                      "  </td>"
                      "</tr>"
    }
  }

  buffered_out += "</table>"

  return buffered_out
}
