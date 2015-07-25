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

    if (env == "favicon.ico") env = ""

    if (env == "") {
      buffered_out += showEnviromentSelection ()
    } else if (action == "build") {
      buffered_out += build (playbook, env)
    } else if (action == "reforge") {
      buffered_out += reforge (playbook, env)
    } else if (action == "hotswap") {
      buffered_out += hotswap (playbook, env, role, function (buffered_out) {
        res.send (buffered_out)
      })
    } else {
      buffered_out += showIndex (env)
    }

    if (action != "hotswap")
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
    files_ = files_ || []

    try {
      var files = fs.readdirSync(dir)

      for (var i in files) {
          var name = dir + '/' + files[i]

          files_.push(name)
      }

      return files_
    } catch (e) {
      return -1
    }
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

function hotswap (playbook, env, role, callback) {
  var all_roles    = sh.exec ("cat " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + "/hosts/" + env + " | grep teluswebteam.com").stdout.split(/\r\n|\r|\n/g),
      current_role = "",
      buffered_out = "",
      params       = {
        DryRun: false,
        Filters: [{
            Name: 'instance.group-name',
            Values: [playbook + "-" + role]
          }]
      }

  for (var r in all_roles) {
    if (all_roles[r].indexOf (role) >= 0) {
      current_role = all_roles[r]
    }
  }

  AWS.config.region = ENVIROMENT_AWS_REGION_MAP[env]

  new AWS.EC2().describeInstances(params, function(error, data) {
    if (error) {
      console.log(error)
    } else {
      findInstance (data, playbook, current_role, function () {
        console.log ("Rebuild without DNS")
        rebuildWithoutDNS (playbook, env, function (buffered_out) {
          console.log (">"+buffered_out)
          callback (buffered_out)
        })
      })
    }
  })
}

function findInstance (data, playbook, enviroment, callback) {
  var instance   = data.Reservations[0].Instances[0],
      instanceId = instance.InstanceId,
      tags       = instance.Tags

  for (t in tags) {
    var key   = tags[t].Key,
        value = tags[t].Value

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
        console.log("Tagging instance", err ? "failure" : "success")

        if (!err) {
          console.log (callback())
        }
      })
    }
  }
}

function rebuildWithoutDNS (playbook, enviroment, callback) {
  var cmd           = "cd " + CONFIG.REPOSITORY_HOME + "/playbook-" + playbook + " && " +
                      "ansible-playbook infrastructure.yml -i hosts/" + enviroment + " --skip-tags dns",
      buffered_out  = "<h1>Hotswapping " + playbook + " in " + enviroment + "</h1><h2>" + cmd + "</h2>"
                    + "<pre>" + sh.exec (cmd).stdout + "</pre>"

    //  sendSlack (playbook + " infra completed in " + env)

  callback (buffered_out)
}

function showEnviromentSelection () {
  var buffered_out = "<h1>Select enviroment</h1>"
                   + "  <ul>"
                   + "    <li><a href='next/'>next</a></li>"
                   + "    <li><a href='development/'>development</a></li>"
                   + "    <li><a href='staging/'>staging</a></li>"
                   + "    <li><a href='production/'>production</a></li>"
                   + "  </ul>"

  return buffered_out
}

function showIndex (enviroment) {
  var playbook_files = getFiles(CONFIG.REPOSITORY_HOME),
      buffered_out   = "<h1><a href='../'>&lt;</a>" + enviroment + "</h1>"
                     + "<table>"
                     + "  <tr>"
                     + "    <th>Playbook</th>"
                     + "    <th></th>"
                     + "  </tr>"

  for (var i in playbook_files) {
    var playbook_file = playbook_files[i].replace (CONFIG.REPOSITORY_HOME + "/", "")

    if (playbook_file.indexOf ("playbook-") == 0) {
      var this_playbook = playbook_file.replace ("playbook-", ""),
          roles         = sh.exec ("cat " + CONFIG.REPOSITORY_HOME + "/playbook-" + this_playbook + "/hosts/" + enviroment + " | grep teluswebteam.com").stdout.split(/\r\n|\r|\n/g)

      buffered_out += "<tr>"
                    + "  <td>" + this_playbook + "</td>"
                    + "  <td>"
                    + "    <a href='/" + enviroment + "/build/" + this_playbook + "'>build infra</a> | "
                    + "    <a href='/" + enviroment + "/reforge/" + this_playbook + "'>reforge</a> | "
                    + "    hotswap: "

      for (var r in roles) {
        var role = roles[r].split(".")[0]

        if (role.indexOf("cat:") != 0)
          buffered_out += "      <a href='/" + enviroment + "/hotswap/" + this_playbook + "/" + role + "'>" + role + "</a>"
      }

      buffered_out += "  </td>"
                    + "</tr>"
    }
  }

  buffered_out += "</table>"

  return buffered_out
}
